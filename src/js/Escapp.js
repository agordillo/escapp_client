/*
 * ESCAPP
 * This library provides utils for using the educational escape rooms manager Escapp in a client-side web application.
 *
 * GING
 * https://github.com/agordillo/escapp_client
 * Creative Commons Attribution-ShareAlike 4.0 International License.
 *
 * @version 0.0.1
 */
import 'es6-promise';
import "isomorphic-fetch";
import Bowser from "bowser";
import * as Utils from './Utils.js';
import * as I18n from './I18n.js';
import * as LocalStorage from './Storage.js';
import * as Dialogs from './Dialogs.js';

let DEFAULT_ESCAPP_ER_STATE = {"puzzlesSolved": [], "hintsAllowed": true};

export default function ESCAPP(options){

  //Default options
  let defaults = {
    endpoint: undefined,
    localStorageKey: "ESCAPP",
    imagesPath: "./images/",
    restoreState: "REQUEST_USER", //AUTO, AUTO_NOTIFICATION, REQUEST_USER, NEVER
    user: {
      email: undefined,
      password: undefined,
      token: undefined,
      authenticated: false,
      participation: undefined
    },
    localErState: undefined,
    remoteErState: undefined,
    autovalidate: false,
    I18n: undefined,
    browserRestrictions: {
      "internet explorer": ">10",
      "chrome": ">41",
      "firefox": ">38"
    },
    browserRestrictionsDefault: true,
    initCallback: undefined,
  };

  // Settings merged with defaults and extended options
  let settings = Utils.deepMerge(defaults, options);

  //////////////////
  // Init
  //////////////////

  this.init = function(){
    //Init modules
    I18n.init(settings.I18n);
    LocalStorage.init(settings.localStorageKey);
    Dialogs.init({imagesPath: settings.imagesPath});

    //Get user from LocalStorage
    let user = LocalStorage.getSetting("user");
    if(typeof user === "object"){
      settings.user = user;
    } else {
      //Check URL params
      let URL_params = Utils.getParamsFromCurrentUrl();
      let user = this.getUserCredentials({email: URL_params.email, password: URL_params.password, token: URL_params.token});    
      if(typeof user !== "undefined"){
        settings.user = user;
        settings.user.authenticated = true;
        settings.user.participation = "PARTICIPANT";
      }
    }

    //Get escape room state from LocalStorage
    let localErState = LocalStorage.getSetting("localErState");
    if(this.validateERState(localErState)===false){
      localErState = DEFAULT_ESCAPP_ER_STATE;
    }
    settings.localErState = localErState;
    LocalStorage.saveSetting("localErState",settings.localErState);
  };


  //////////////////
  // Client API
  //////////////////

  this.isSupported = function(){
    let isValidBrowser;

    //Use bowser (https://github.com/lancedikson/bowser) to detect browser
    try {
      let browser = Bowser.getParser(window.navigator.userAgent);
      // console.log(browser.getBrowser());
      isValidBrowser = browser.satisfies(settings.browserRestrictions);
      if(typeof isValidBrowser === "undefined"){
        //No rule for the browser has been specified
        isValidBrowser = settings.browserRestrictionsDefault;
      }
    } catch(e){
      //Browser has not been recognized
      isValidBrowser = settings.browserRestrictionsDefault;
    }

    //Check specific features
    let featuresSupported = LocalStorage.isSupported();
    
    return ((isValidBrowser)&&(featuresSupported));
  };

  this.validate = function(callback){
    if(this.isSupported() === true){
      return this.validateUser(callback);
    } else {
      return this.displayCustomDialog(I18n.getTrans("i.notsupported_title"),I18n.getTrans("i.notsupported_text"),function(response){
        if(typeof callback === "function"){
          callback(false,undefined);
        }
      });
    }
  };

  this.validateUser = function(callback){
    if((settings.user.authenticated !== true)||(settings.user.participation !== "PARTICIPANT")){
      this.displayUserAuthDialog(true,function(success){
        if(success){
          this.getStateToRestore(function(er_state){
            if(typeof callback === "function"){
              callback(true,er_state);
            }
          });
        } else {
          this.resetUserCredentials();
          return this.validateUser(callback);
        }
      }.bind(this));
    } else {
      this.retrieveState(function(success,er_state){
        if(success){
          if(typeof callback === "function"){
            callback(true,er_state);
          }
        } else {
          this.resetUserCredentials();
          return this.validateUser(callback);
        }
      }.bind(this));
    }
  };

  this.displayCustomDialog = function(title,text,callback){
    let dialogOptions = {title: title, text: text};
    if(typeof callback === "function"){
      dialogOptions.closeCallback = function(response){
        callback(response);
      }.bind(this);
    }
    this.displayDialog(dialogOptions);
  };

  this.reset = function(callback){
    this.resetUserCredentials();
    LocalStorage.clear();
    if(typeof callback === "function"){
      callback();
    }
  };

  this.addUserCredentialsToUrl = function(url){
    let userCredentials = this.getUserCredentials(settings.user);
    if(typeof userCredentials === "undefined"){
      return url;
    }
    url = Utils.addParamToUrl(url,"email",userCredentials.email);
    url = Utils.addParamToUrl(url,"token",userCredentials.token);
    //Password is never shown on URLs.
    return url;
  };

  //////////////////
  // Escapp API
  //////////////////

  this.auth = function(user,callback){
    let userCredentials = this.getUserCredentials(user);
    if(typeof userCredentials === "undefined"){
      //Invalid params
      if(typeof callback === "function"){
        callback(false);
      }
      return;
    }

    let that = this;
    let authUserURL = settings.endpoint + "/auth";
    fetch(authUserURL, {
        "method": "POST",
        "body": JSON.stringify(userCredentials),
        headers: {
            "Content-type": "application/json",
            "Accept-Language": "es-ES"
        }
    })
    .then(res => res.json()).then(function(res){
      settings.user = userCredentials;
      if(typeof res.token === "string"){
        settings.user.token = res.token;
        delete settings.user.password;
      }
      settings.user.authenticated = (res.authentication === true);
      settings.user.participation = res.participation;
      LocalStorage.saveSetting("user", settings.user);

      if(that.validateERState(res.erState)){
        settings.remoteErState = res.erState;
      }

      if(typeof callback === "function"){
        callback(settings.user.authenticated);
      }
    });
  };

  this.retrieveState = function(callback){
    this.auth(settings.user,function(success){
      if((settings.user.authenticated)&&(settings.user.participation==="PARTICIPANT")){
        this.getStateToRestore(function(er_state){
          if(typeof callback === "function"){
            callback(true,er_state);
          }
        });
      } else {
        if(typeof callback === "function"){
          callback(false,undefined);
        }
      }
    }.bind(this));
  };

  this.submitPuzzle = function(puzzle_id,solution,options,callback){
    let userCredentials = this.getUserCredentials(settings.user);
    if(typeof userCredentials === "undefined"){
      callback(false,{msg: "Invalid params"});
    }
    let that = this;
    let submitPuzzleURL = settings.endpoint + "/puzzles/" + puzzle_id + "/submit";
    let body = userCredentials;
    body.solution = solution;
    
    fetch(submitPuzzleURL, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        "Content-type": "application/json",
        "Accept-Language": "es-ES"
      }
    }).then(res => res.json()).then(function(res){
        if(that.validateERState(res.erState)){
          settings.remoteErState = res.erState;
        }
        let submitSuccess = (res.code === "OK");
        if(submitSuccess){
          //Puzzle solved
          if(settings.localErState.puzzlesSolved.indexOf(puzzle_id)===-1){
            settings.localErState.puzzlesSolved.push(puzzle_id);
            LocalStorage.saveSetting("localErState",settings.localErState);
          }
        } 
        if(typeof callback === "function"){
          callback(submitSuccess,res);
        }
      }
    );
  };

  this.sendData = function(data,callback){
    //TODO
  };

  this.retrieveData = function(callback){
    //TODO
  };


  //////////////////
  // Utils
  //////////////////

  this.getUserCredentials = function(user){
    if((typeof user !== "object")||(typeof user.email !== "string")||((typeof user.token !== "string")&&(typeof user.password !== "string"))){
      return undefined;
    }
    let userCredentials = {email: user.email};
    if(typeof user.token === "string"){
      userCredentials.token = user.token;
    } else {
      userCredentials.password = user.password;
    }
    return userCredentials;
  }

  this.resetUserCredentials = function(){
    settings.user = {
      email: undefined,
      password: undefined,
      token: undefined,
      authenthicated: false,
      participation: undefined
    };
    settings.localErState = DEFAULT_ESCAPP_ER_STATE;
    settings.remoteErState = undefined;
    LocalStorage.removeSetting("user");
  };

  this.getStateToRestore = function(callback){
    if(settings.restoreState==="NEVER"){
      if(typeof callback === "function"){
        callback(undefined);
      }
      return;
    }

    if(this.validateERState(settings.localErState)===false){
      settings.localErState = Utils.deepMerge({}, DEFAULT_ESCAPP_ER_STATE);
    }
    let remote_state_is_newest = this.isRemoteStateNewest();
    let er_state_to_restore = (remote_state_is_newest ? settings.remoteErState : settings.localErState);

    if((settings.restoreState==="AUTO")||(remote_state_is_newest===false)){
      this.beforeRestoreState(er_state_to_restore);
      if(typeof callback === "function"){
        callback(er_state_to_restore);
      }
      return;
    }

    //Ask or notify before returning remoteErState
    this.displayRestoreStateDialog(function(success){
      if(success===false){
        er_state_to_restore = settings.localErState;
      }
      this.beforeRestoreState(er_state_to_restore);
      if(typeof callback === "function"){
        callback(er_state_to_restore);
      }
    }.bind(this));
  };

  this.beforeRestoreState = function(er_state_to_restore){
    settings.localErState = er_state_to_restore;
    LocalStorage.saveSetting("localErState",settings.localErState);
    settings.remoteErState = undefined;
  };

  this.isRemoteStateNewest = function(){
    let localErState_valid = this.validateERState(settings.localErState);
    let remoteErState_valid = this.validateERState(settings.remoteErState);

    if(remoteErState_valid===false){
      return false;
    }
    if(localErState_valid===false){
      return true;
    }
    return (settings.remoteErState.puzzlesSolved.length > settings.localErState.puzzlesSolved.length);
  };

  this.validateERState = function(er_state){
    return ((typeof er_state === "object")&&(er_state.puzzlesSolved instanceof Array));
  };


  //////////////////
  // UI
  //////////////////

  this.displayUserAuthDialog = function(firstTime,callback){
    let dialogOptions = {requireInput:true};
    if(firstTime){
      dialogOptions.title = I18n.getTrans("i.auth_title");
      dialogOptions.text = I18n.getTrans("i.auth_text");
    } else {
      dialogOptions.title = I18n.getTrans("i.auth_title_wrong_credentials");
      dialogOptions.text = I18n.getTrans("i.auth_text_wrong_credentials");
    }
    dialogOptions.inputs = [
      {
        "type":"text",
        "label":I18n.getTrans("i.auth_email_label"),
        "validate":function(email){return Utils.validateEmail(email);},
      }, {
        "type":"password",
        "label":I18n.getTrans("i.auth_password_label"),
      },
    ];
    dialogOptions.closeCallback = function(response){
      let user = {email:response.inputs[0], password:response.inputs[1]};
      this.auth(user,function(success){
        if(settings.user.authenticated === true){
          // User authentication succesfull
          if(settings.user.participation !== "PARTICIPANT"){
            //User is authenticated but not a participant
            this.displayUserParticipationErrorDialog(function(){
              if(typeof callback === "function"){
                callback(false);
              }
            });
          } else {
            if(typeof callback === "function"){
              callback(true);
            }
          }
        } else {
          return this.displayUserAuthDialog(false,callback);
        }
      }.bind(this));
    }.bind(this);

    this.displayDialog(dialogOptions);
  };

  this.displayUserParticipationErrorDialog = function(callback){
    let dialogOptions = {};
    dialogOptions.title = I18n.getTrans("i.generic_error_title");

    switch(settings.user.participation){
      case "TOO_LATE":
        dialogOptions.text = I18n.getTrans("i.participation_error_TOO_LATE");
        break;
      case "NOT_ACTIVE":
        dialogOptions.text = I18n.getTrans("i.participation_error_NOT_ACTIVE");
        break;
      case "NOT_STARTED":
        dialogOptions.text = I18n.getTrans("i.participation_error_NOT_STARTED");
        break;
      case "AUTHOR":
      case "NOT_A_PARTICIPANT":
      default:
        dialogOptions.text = I18n.getTrans("i.participation_error_NOT_A_PARTICIPANT");
        break;
    }
    if(typeof callback === "function"){
      dialogOptions.closeCallback = function(response){
        callback(response);
      }.bind(this);
    }
    this.displayDialog(dialogOptions);
  };

  this.displayRestoreStateDialog = function(callback){
    let dialogOptions = {requireInput:true};
    
    dialogOptions.title = I18n.getTrans("i.restore_title");

    if(settings.restoreState==="AUTO_NOTIFICATION"){
      dialogOptions.text = I18n.getTrans("i.restore_auto_text");
    } else {
      //REQUEST_USER
      dialogOptions.text = I18n.getTrans("i.restore_request_text");

      dialogOptions.buttons = [
        {
          "response":"ok",
          "label":I18n.getTrans("i.button_ok"),
        }, {
          "response":"nok",
          "label":I18n.getTrans("i.button_nok"),
        },
      ];
    }
    
    if(typeof callback === "function"){
      dialogOptions.closeCallback = function(response){
        let _response = ((settings.restoreState==="AUTO_NOTIFICATION")||(response.choice==="ok"));
        callback(_response);
      }.bind(this);
    }

    this.displayDialog(dialogOptions);
  };

  this.displayDialog = function(options){
    return Dialogs.displayDialog(options);
  };


  //Initialization
  this.init();

  //Validate after init if autovalidation is enabled
  if(settings.autovalidate === true){
    this.validate(settings.initCallback);
  } else {
    if(typeof settings.initCallback === "function"){
      settings.initCallback();
    }
  }

};

window.ESCAPP = ESCAPP;