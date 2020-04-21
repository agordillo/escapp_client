import * as Utils from './Utils.js';
import * as I18n from './I18n.js';
import './jquery-3.4.0.min.js';
import './notify.js';
import '../css/notifications.scss';

let initialized = false;
let enabled = false;
let imagesPath;

let hideTimer;
let isHideTimerRunning = false;
let hideTimerValue = 0;

export function init(options){
  if(initialized === true){
    return;
  }
  initialized = true;

  switch(options.enabled){
    case true:
      enabled = true;
      break;
    case "FALSE_IF_EMBED":
      enabled = (Utils.isEmbed() === false);
      break;
    default:
      enabled = false;
  }

  imagesPath = options.imagesPath || "/assets/images/";

  //Escapp is the default boostrap style. Will be overriden from CSS.
  $.notify.addStyle("escapp", {
    html: "<div>\n<span data-notify-text></span>\n</div>",
  });
}

export function isEnabled(){
  return enabled;
};

export function displayNotification(options = {}){
  if(enabled !== true){
    return;
  }

  if((typeof options !== "object")||(typeof options.text !== "string")||(options.text.trim() === "")){
    return;
  }

  if(options.escapp === true){
    options.type = "event";
  }

  if(["ranking","info","warning","event","time","error"].indexOf(options.type)===-1){
    options.type = "event";
  }
  switch(options.type){
    case "ranking":
      return displayRankingNotification(options);
    case "info":
      return displayInfoNotification(options);
    case "warning":
      return displayWarningNotification(options);
    case "event":
      return displayEventNotification(options);
    case "time":
      return displayTimeNotification(options);
    case "error":
      return displayErrorNotification(options);
    default:
      return;
  }
}

function displayRankingNotification(options = {}){
  let notificationOptions = Utils.deepMerge(options,{
    className: "ranking",
  });
  return _displayNotification(notificationOptions);
};

function displayInfoNotification(options = {}){
  let notificationOptions = Utils.deepMerge(options,{
    className: "info",
  });
  return _displayNotification(notificationOptions);
};

function displayWarningNotification(options = {}){
  let notificationOptions = Utils.deepMerge(options,{
    className: "warn",
    autoHide: false,
  });
  return _displayNotification(notificationOptions);
};

function displayEventNotification(options = {}){
  let notificationOptions = Utils.deepMerge(options,{
    className: 'event',
  });
  return _displayNotification(notificationOptions);
};

function displayTimeNotification(options = {}){
  let notificationOptions = Utils.deepMerge(options,{
    className: 'time',
  });
  return _displayNotification(notificationOptions);
};

function displayErrorNotification(options = {}){
  let notificationOptions = Utils.deepMerge(options,{
    className: 'error',
    autoHide: false,
  });
  return _displayNotification(notificationOptions);
};

function _displayNotification(options = {}){
  let autoHideDelay = getAutoHideDelay(options.text);
  let notificationOptions = Utils.deepMerge({
    className: 'event',
    style: 'escapp',
    clickToHide: true,
    autoHide: true,
    autoHideDelay: getAutoHideDelay(options.text),
    globalPosition: 'top right',
    showAnimation: 'fadeIn',
    showDuration: 600,
    hideAnimation: 'fadeOut',
    hideDuration: 600,
    gap: 0
  },options);
  
  if(["success","info","warn","error","ranking","event"].indexOf(options.className)===-1){
    options.className = "event";
  }

  //Handle time
  hideTimerValue = autoHideDelay;
  if(isHideTimerRunning === false){
    isHideTimerRunning = true;
    hideTimer = setInterval(function(){
      hideTimerValue = Math.max(0,hideTimerValue - 1000);
      if(hideTimerValue === 0){
        if(typeof hideTimer !== "undefined"){
          clearInterval(hideTimer);
          isHideTimerRunning = false;
        }
      }
    },1000);
  }

  $.notify(notificationOptions.text, notificationOptions);
};

function getAutoHideDelay(text = ""){
  return hideTimerValue + Math.min(20000,Math.max(4000, 1000 + text.split(" ").length * 500));
}