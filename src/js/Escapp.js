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
import * as Encrypt from './Encrypt.js';
import * as Dialogs from './Dialogs.js';
import * as Animations from './Animations.js';

let DEFAULT_ESCAPP_ER_STATE = {"puzzlesSolved": [], "hintsAllowed": true};

export default function ESCAPP(options){

  //Default options
  let defaults = {
    initCallback: undefined,
    endpoint: undefined,
    localStorageKey: "ESCAPP",
    encryptKey: undefined,
    imagesPath: "./images/",
    restoreState: "REQUEST_USER", //AUTO, AUTO_NOTIFICATION, REQUEST_USER, NEVER
    I18n: undefined,
    browserRestrictions: {
      "internet explorer": ">10",
      "chrome": ">41",
      "firefox": ">38"
    },
    browserRestrictionsDefault: true,
    autovalidate: false,
    appPuzzleIds: undefined,
    requiredPuzzlesIds: undefined,
    forceValidation: true,
    user: {
      email: undefined,
      password: undefined,
      token: undefined,
      authenticated: false,
      participation: undefined
    },
    localErState: undefined,
    remoteErState: undefined,
    puzzlesRequirements: true,
  };

  // Settings merged with defaults and extended options
  let settings = Utils.deepMerge(defaults, options);
  if(typeof settings.encryptKey === "undefined"){
    settings.encryptKey = settings.localStorageKey;
  }

  //////////////////
  // Init
  //////////////////

  this.init = function(){
    //Init modules
    I18n.init(settings.I18n);
    LocalStorage.init(settings.localStorageKey);
    Encrypt.init(settings.encryptKey);
    Dialogs.init({imagesPath: settings.imagesPath});
    Animations.init({imagesPath: settings.imagesPath});

    //Get user from LocalStorage
    let user = LocalStorage.getSetting("user");
    if(typeof user === "object"){
      settings.user = user;
    } else {
      //Check URL params
      let URL_params = Utils.getParamsFromCurrentUrl();
      let user = this.getUserCredentials({email: URL_params.email, token: URL_params.token});    
      if(typeof user !== "undefined"){
        settings.user = user;
        settings.user.authenticated = true;
        settings.user.participation = "PARTICIPANT";
      }
    }

    //Get escape room state from LocalStorage
    let localErState = LocalStorage.getSetting("localErState");
    if(this.validateERState(localErState)===false){
      localErState = Utils.deepMerge({}, DEFAULT_ESCAPP_ER_STATE);
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
      return this.displayCustomEscappDialog(I18n.getTrans("i.notsupported_title"),I18n.getTrans("i.notsupported_text"),{},function(response){
        if(typeof callback === "function"){
          callback(false,undefined);
        }
      });
    }
  };

  this.validateUser = function(callback){
    if((settings.user.authenticated !== true)||(settings.user.participation !== "PARTICIPANT")){
      this.displayUserAuthDialog(true,function(success){
        if((success)||(settings.forceValidation===false)){
          return this.validateUserAfterAuth(callback);
        } else {
          this.resetUserCredentials();
          return this.validateUser(callback);
        }
      }.bind(this));
    } else {
      this.retrieveState(function(success,erState){
        if((success)||(settings.forceValidation===false)){
          if(typeof callback === "function"){
            callback(success,erState);
          }
        } else {
          this.resetUserCredentials();
          return this.validateUser(callback);
        }
      }.bind(this));
    }
  };

  this.displayCustomEscappDialog = function(title,text,extraOptions,callback){
    let dialogOptions = Utils.deepMerge((extraOptions || {}),{escapp: true});
    this.displayCustomDialog(title,text,dialogOptions,callback);
  };

  this.displayPuzzleDialog = function(title,text,extraOptions,callback){
    let dialogOptions = {escapp: false, icon: "lock"};
    dialogOptions.inputs = [
      {
        "type":"text",
        "autocomplete":"off",
        "validate":function(solution){return Utils.validateString(solution)},
      }
    ];
    dialogOptions.buttons = [
      {
        "response":"ok",
        "label":I18n.getTrans("i.button_ok"),
      },
      {
        "response":"cancel",
        "label":I18n.getTrans("i.button_nok"),
        "ignoreInputs":true,
      },
    ];
    if(typeof callback === "function"){
      dialogOptions.closeCallback = function(dialogResponse){
        if((dialogResponse.inputs instanceof Array)&&(dialogResponse.inputs.length === 1)){
          dialogResponse.value = dialogResponse.inputs[0];
        }
        callback(dialogResponse);
      }
    }
    if(typeof extraOptions === "object"){
      dialogOptions = Object.assign(dialogOptions,extraOptions);
    }
    this.displayCustomDialog(title,text,dialogOptions,callback);
  };

  this.displayCompletionDialog = function(extraOptions,callback){
    let dialogOptions = {escapp: true, img: (settings.imagesPath + "/trophy.png")};
    if(typeof extraOptions === "object"){
      dialogOptions = Object.assign(dialogOptions,extraOptions);
    }
    dialogOptions.closeCallback = function(){
      setTimeout(function(){
        this.stopAnimation("confetti");
      }.bind(this),1500);
      if(typeof callback === "function"){
        callback();
      }
    }.bind(this);
    this.startAnimation("confetti");
    this.displayCustomDialog(I18n.getTrans("i.completion_title"),I18n.getTrans("i.completion_text",{escappURL: this.getEscappPlatformFinishURL()}),dialogOptions,callback);
  };

  this.displayCustomDialog = function(title,text,extraOptions,callback){
    let dialogOptions = {title: title, text: text, escapp: false, icon: undefined};
    if(typeof callback === "function"){
      dialogOptions.closeCallback = function(response){
        callback(response);
      }.bind(this);
    }
    if(typeof extraOptions === "object"){
      dialogOptions = Object.assign(dialogOptions,extraOptions);
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

  this.encrypt = function(value,algorithm,options={}){
    return Encrypt.encrypt(value,algorithm,options);
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

  this.startAnimation = function(animation,time){
    Animations.startAnimation(animation,time);
  };

  this.stopAnimation = function(animation){
    Animations.stopAnimation(animation);
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
      if((success)&&(settings.user.authenticated)&&(settings.user.participation==="PARTICIPANT")){
        return this.validateUserAfterAuth(callback);
      } else {
        if(typeof callback === "function"){
          callback(false,undefined);
        }
      }
    }.bind(this));
  };

  this.submitPuzzle = function(puzzleId,solution,options,callback){
    let userCredentials = this.getUserCredentials(settings.user);
    if(typeof userCredentials === "undefined"){
      if(typeof callback === "function"){
        callback(false,{msg: "Invalid params"});
      }
      return;
    }
    if((typeof puzzleId === "undefined")&&(settings.appPuzzleIds instanceof Array)&&(settings.appPuzzleIds.length === 1)){
      puzzleId = settings.appPuzzleIds[0];
    }
    if(typeof puzzleId === "undefined"){
      if(typeof callback === "function"){
        callback(false,{msg: "Puzzle id not provided"});
      }
      return;
    }
    if(settings.puzzlesRequirements !== true){
      if(typeof callback === "function"){
        callback(false,{msg: "Invalid puzzle requirements"});
      }
      return;
    }

    let that = this;
    let submitPuzzleURL = settings.endpoint + "/puzzles/" + puzzleId + "/submit";
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
          if(that.validateERState(settings.localErState)){
            if(settings.localErState.puzzlesSolved.indexOf(puzzleId)===-1){
              settings.localErState.puzzlesSolved.push(puzzleId);
              LocalStorage.saveSetting("localErState",settings.localErState);
            }
          }
        } 
        if(typeof callback === "function"){
          callback(submitSuccess,res);
        }
      }
    );
  };

  this.start = function(callback){
    let userCredentials = this.getUserCredentials(settings.user);
    if(typeof userCredentials === "undefined"){
      if(typeof callback === "function"){
        callback(false);
      }
      return;
    }

    let that = this;
    let startURL = settings.endpoint + "/start";
    let body = userCredentials;

    fetch(startURL, {
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
        let startSuccess = (res.code === "OK");
        if(typeof callback === "function"){
          callback(startSuccess,res);
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

  this.validateUserAfterAuth = function(callback){
    this.validatePreviousPuzzles(function(success){
        if((success)||(settings.forceValidation===false)){
          this.validateStateToRestore(function(erState){
            if(typeof callback === "function"){
              callback(success,erState);
            }
          });
        } else {
          if(typeof callback === "function"){
            callback(false,undefined);
          }
        }
    }.bind(this));
  };

  this.validatePreviousPuzzles = function(callback){
    if((!(settings.requiredPuzzlesIds instanceof Array))||(settings.requiredPuzzlesIds.length === 0)){
      if(typeof callback === "function"){
        callback(true);
      }
    } else {
      //Check requirement
      let stateToVerifyPuzzleRequirements = this.getNewestState();
      if(this.validateERState(stateToVerifyPuzzleRequirements)===false){
        settings.puzzlesRequirements = false;
      } else {
        for(let i=0; i<settings.requiredPuzzlesIds.length; i++){
          if(stateToVerifyPuzzleRequirements.puzzlesSolved.indexOf(settings.requiredPuzzlesIds[i])===-1){
            settings.puzzlesRequirements = false;
            break;
          }
        }
      }
      if(settings.puzzlesRequirements===false){
        this.displayPuzzleRequirementDialog(function(response){
          if(typeof callback === "function"){
            callback(false,undefined);
          }
        });
      } else {
        if(typeof callback === "function"){
          callback(true);
        }
      }
    }
  };

  this.validateStateToRestore = function(callback){
    if(settings.restoreState==="NEVER"){
      if(typeof callback === "function"){
        callback(undefined);
      }
      return;
    }

    let remoteStateIsNewest = this.isRemoteStateNewest();
    let erStateToRestore = this.getNewestState();

    if((settings.restoreState==="AUTO")||(remoteStateIsNewest===false)){
      return this.updateErStates(erStateToRestore,callback);
    }

    if((settings.appPuzzleIds instanceof Array)&&(settings.appPuzzleIds.length > 0)){
      if(this.isRemoteStateNewestForApp()===false){
        //State is new but not for this app. Prevent dialog, but update.
        return this.updateErStates(erStateToRestore,callback);
      }
    }

    //Ask or notify before returning remoteErState
    this.displayRestoreStateDialog(function(success){
      if(success===false){
        erStateToRestore = settings.localErState;
      }
      return this.updateErStates(erStateToRestore,callback);
    }.bind(this));
  };

  this.updateErStates = function(erStateToRestore,callback){
    if(this.validateERState(erStateToRestore)){
      settings.localErState = erStateToRestore;
      LocalStorage.saveSetting("localErState",settings.localErState);
      settings.remoteErState = undefined;
    }
    if(typeof callback === "function"){
      callback(erStateToRestore);
    }
  };

  this.getNewestState = function(){
    return (this.isRemoteStateNewest() ? settings.remoteErState : settings.localErState);
  }

  this.isRemoteStateNewest = function(appScope){
    let localErStateValid = this.validateERState(settings.localErState);
    let remoteErStateValid = this.validateERState(settings.remoteErState);

    if(remoteErStateValid===false){
      return false;
    }
    if(localErStateValid===false){
      return true;
    }

    if(appScope===true){
      if((settings.appPuzzleIds instanceof Array)&&(settings.appPuzzleIds.length > 0)){
        //Filter
        let _localErState = Utils.deepMerge({},settings.localErState);
        _localErState.puzzlesSolved = _localErState.puzzlesSolved.filter(puzzle_id => settings.appPuzzleIds.indexOf(puzzle_id)!==-1);
        let _remoteErState = Utils.deepMerge({},settings.remoteErState);
        _remoteErState.puzzlesSolved = _remoteErState.puzzlesSolved.filter(puzzle_id => settings.appPuzzleIds.indexOf(puzzle_id)!==-1);
        return this.isStateNewestThan(_remoteErState,_localErState);
      }
    }

    return this.isStateNewestThan(settings.remoteErState,settings.localErState);
  };

  this.isStateNewestThan = function(erStateA,erStateB){
    if(erStateA.puzzlesSolved.length === 0){
      return false;
    }
    if(erStateB.puzzlesSolved.length === 0){
      return true;
    }
    //Current version assumes that the ER has a linear structure of puzzles.
    return (erStateA.puzzlesSolved.length > erStateB.puzzlesSolved.length);
  };

  this.isRemoteStateNewestForApp = function(){
    return this.isRemoteStateNewest(true);
  };

  this.validateERState = function(erState){
    return ((typeof erState === "object")&&(erState.puzzlesSolved instanceof Array));
  };

  this.getEscappPlatformURL = function(){
    return settings.endpoint.replace("/api","");
  };

  this.getEscappPlatformFinishURL = function(){
    return settings.endpoint.replace("/api","") + "/finish";
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
    dialogOptions.buttons = [{"response":"ok","label":I18n.getTrans("i.button_ok")}];
    if(settings.forceValidation===false){
      dialogOptions.buttons.push({"response":"cancel","label":I18n.getTrans("i.button_nok"),"ignoreInputs":true});
    }
    dialogOptions.closeCallback = function(dialogResponse){
      if((settings.forceValidation!==false)||(dialogResponse.choice==="ok")){
        let user = {email:dialogResponse.inputs[0], password:dialogResponse.inputs[1]};
        this.auth(user,function(success){
          if(settings.user.authenticated === true){
            // User authentication succesfull
            if(["PARTICIPANT","NOT_STARTED"].indexOf(settings.user.participation) === -1){
              //User is authenticated but not a participant
              this.displayUserParticipationErrorDialog(function(){
                if(typeof callback === "function"){
                  callback(false);
                }
              });
            } else {
              if(settings.user.participation === "NOT_STARTED"){
                //User is authenticated and a participant, but the escape room needs to be started.
                //Ask the participant if he/she wants to start the escape room.
                this.displayStartDialog(function(start){
                  if(start===true){
                    //User wants to init escape room
                     this.start(function(success){
                      //ER started (unless error on server side)
                      if(typeof callback === "function"){
                        callback((success===true));
                      }
                    });
                  } else {
                    //User do not want to init escape room
                    //Display error message
                    if(typeof callback === "function"){
                      callback(false);
                    }
                  }
                }.bind(this));
              } else {
                //settings.user.participation === "PARTICIPANT"
                //User is authenticated, user is a participant, and user has started the escape room.
                if(typeof callback === "function"){
                  callback(true);
                }
              }
            }
          } else {
            return this.displayUserAuthDialog(false,callback);
          }
        }.bind(this));
      } else {
        if(typeof callback === "function"){
          callback(false);
        }
      }
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

  this.displayPuzzleRequirementDialog = function(callback){
    let dialogOptions = {};
    dialogOptions.title = I18n.getTrans("i.generic_error_title");
    dialogOptions.text = I18n.getTrans("i.puzzles_required");
    dialogOptions.buttons = [];
    if(settings.forceValidation===false){
      dialogOptions.buttons.push({"response":"ok","label":I18n.getTrans("i.button_ok")});
    }
    if(typeof callback === "function"){
      dialogOptions.closeCallback = function(dialogResponse){
        callback(dialogResponse);
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
      dialogOptions.closeCallback = function(dialogResponse){
        let response = ((settings.restoreState==="AUTO_NOTIFICATION")||(dialogResponse.choice==="ok"));
        callback(response);
      }.bind(this);
    }

    this.displayDialog(dialogOptions);
  };

  this.displayStartDialog = function(callback){
    let dialogOptions = {};
    dialogOptions.title = I18n.getTrans("i.start_title");
    dialogOptions.text = I18n.getTrans("i.start_text");
    dialogOptions.buttons = [
      {
        "response":"ok",
        "label":I18n.getTrans("i.button_ok"),
      }, {
        "response":"nok",
        "label":I18n.getTrans("i.button_nok"),
      },
    ];
    
    if(typeof callback === "function"){
      dialogOptions.closeCallback = function(dialogResponse){
        let response = (dialogResponse.choice==="ok");
        callback(response);
      }.bind(this);
    }
    this.displayDialog(dialogOptions);
  };

  this.displayDialog = function(options){
    options = Utils.deepMerge({escapp:true},(options || {}));
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