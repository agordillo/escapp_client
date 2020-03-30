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
    imagesPath: "/assets/images/",
    restoreState: "REQUEST_USER", //AUTO, AUTO_NOTIFICATION, REQUEST_USER, NEVER
    user: {
      email: undefined,
      password: undefined,
      token: undefined,
      authenticated: false,
      participation: undefined
    },
    local_er_state: undefined,
    remote_er_state: undefined,
    I18n: undefined,
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
      if((typeof URL_params.email === "string")&&(typeof URL_params.password === "string")||(typeof URL_params.token === "string")){
        let user = this.getUserCredentials({email: URL_params.email, password: URL_params.password, token: URL_params.token})    
        settings.user = user;
        settings.user.authenticated = true;
        settings.user.participation = "PARTICIPANT";
      }
    }

    //Get escape room state from LocalStorage
    let local_er_state = LocalStorage.getSetting("local_er_state");
    if(this.validateERState(local_er_state)===false){
      local_er_state = DEFAULT_ESCAPP_ER_STATE;
    }
    settings.local_er_state = local_er_state;
    LocalStorage.saveSetting("local_er_state",local_er_state);
  };


  //////////////////
  // Client API
  //////////////////

  this.isSupported = function(){
    return LocalStorage.isSupported();
  };

  this.validateUser = function(callback){
    if((settings.user.authenticated !== true)||(settings.user.participation !== "PARTICIPANT")){
      this.displayUserAuthDialog(true,function(success){
        if(success){
          this.getStateToRestore(function(er_state){
            callback(er_state);
          });
        } else {
          this.resetUserCredentials();
          return this.validateUser(callback);
        }
      }.bind(this));
    } else {
      this.retrieveState(function(success,er_state){
        if(success){
          callback(er_state);
        } else {
          this.resetUserCredentials();
          return this.validateUser(callback);
        }
      }.bind(this));
    }
  };

  this.displayDialog = function(options){
    return Dialogs.displayDialog(options);
  };


  //////////////////
  // Escapp API
  //////////////////

  this.auth = function(user,callback){
    if((typeof user.email !== "string")||((typeof user.token !== "string")&&(typeof user.password !== "string"))){
      //Invalid params
      return callback(false);
    }

    let that = this;
    let authUserURL = settings.endpoint + "/auth";
    fetch(authUserURL, {
        "method": "POST",
        "body": JSON.stringify(this.getUserCredentials(user)),
        headers: {
            "Content-type": "application/json",
            "Accept-Language": "es-ES"
        }
    })
    .then(res => res.json()).then(function(res){
      settings.user = user;
      if(typeof res.token === "string"){
        settings.user.token = res.token;
        delete settings.user.password;
      }
      settings.user.authenticated = (res.authentication === true);
      settings.user.participation = res.participation;
      LocalStorage.saveSetting("user", settings.user);

      if(that.validateERState(res.erState)){
        settings.remote_er_state = res.erState;
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
    let that = this;
    let submitPuzzleURL = settings.endpoint + "/puzzles/" + puzzle_id + "/submit";
    let body = this.getUserCredentials(settings.user);
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
          settings.remote_er_state = res.erState;
        }
        if(res.code === "OK"){
          //Puzzle solved
          if(settings.local_er_state.puzzlesSolved.indexOf(puzzle_id)===-1){
            settings.local_er_state.puzzlesSolved.push(puzzle_id);
          }
          callback(true,res);
        } else {
          callback(false,res);
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
    settings.local_er_state = DEFAULT_ESCAPP_ER_STATE;
    settings.remote_er_state = undefined;
    LocalStorage.removeSetting("user");
  };

  this.getStateToRestore = function(callback){
    if(settings.restoreState==="NEVER"){
      return callback(DEFAULT_ESCAPP_ER_STATE);
    }
    let local_er_state = settings.local_er_state;
    if(this.validateERState(local_er_state)===false){
      local_er_state = Utils.deepMerge({}, DEFAULT_ESCAPP_ER_STATE);
    }
    let remote_state_is_newest = this.isRemoteStateNewest();
    let er_state_to_restore = (remote_state_is_newest ? settings.remote_er_state : settings.local_er_state);

    if((settings.restoreState==="AUTO")||(remote_state_is_newest===false)){
      this.beforeRestoreState(er_state_to_restore);
      return callback(er_state_to_restore);
    }

    //Ask or notify before returning remote_er_state
    this.displayRestoreStateDialog(function(success){
      if(success===false){
        er_state_to_restore = local_er_state;
      }
      this.beforeRestoreState(er_state_to_restore);
      callback(er_state_to_restore);
    }.bind(this));
  };

  this.beforeRestoreState = function(er_state_to_restore){
    settings.local_er_state = er_state_to_restore;
    LocalStorage.saveSetting("local_er_state",settings.local_er_state);
    settings.remote_er_state = undefined;
  };

  this.isRemoteStateNewest = function(){
    let local_er_state_valid = this.validateERState(settings.local_er_state);
    let remote_er_state_valid = this.validateERState(settings.remote_er_state);

    if(remote_er_state_valid===false){
      return false;
    }
    if(local_er_state_valid===false){
      return true;
    }
    return (settings.remote_er_state.puzzlesSolved.length > settings.local_er_state.puzzlesSolved.length);
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
              callback(false);
            });
          } else {
            callback(true);
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
      default:
        dialogOptions.text = I18n.getTrans("i.participation_error_NOT_A_PARTICIPANT");
        break;
    }
    dialogOptions.closeCallback = function(response){
      callback(response);
    }.bind(this);
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
    
    dialogOptions.closeCallback = function(response){
      let _response = ((settings.restoreState==="AUTO_NOTIFICATION")||(response.choice==="ok"));
      callback(_response);
    }.bind(this);

    this.displayDialog(dialogOptions);
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

  //Initialization
  this.init();

};

window.ESCAPP = ESCAPP;