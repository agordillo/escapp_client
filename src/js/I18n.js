import * as Utils from './Utils.js';
import {LOCALES} from './locales.js';

let settings;

export function init(options){
  if(typeof locale !== "undefined"){
    //Already initialized
    return;
  }

  //Default options
  let defaults = {
    locale: undefined,
    default_locale: "en",
    available_locales: ["es","en"],
  };

  // Settings merged with defaults and extended options
  settings = Utils.deepMerge(defaults, options);
  if(typeof options.locales === "object"){
    LOCALES = Utils.deepMerge(LOCALES, options.locales);
    delete settings.locales;
  }

  // Set default locale
  if((typeof settings.available_locales !== "undefined") && (settings.available_locales instanceof Array) && (settings.available_locales.length > 0)){
    settings.default_locale = settings.available_locales[0]; // Default language
  }

  // Set locale
  if(isValidLanguage(settings.locale)===false){
    let uL = getUserLanguage();
    if(isValidLanguage(uL)){
      settings.locale = uL;
    } else {
      settings.locale = settings.default_locale;
    }
  }
}

export function getLanguage(){
  return settings.locale;
}

function getUserLanguage(){
  // Locale in URL
  let urlParams = Utils.getParamsFromCurrentUrl();
  console.log("URL PARAMS");
  console.log(urlParams);
  if(isValidLanguage(urlParams.locale)){
    return urlParams.locale;
  }
  // Browser language
  let browserLang = (navigator.language || navigator.userLanguage);
  if(isValidLanguage(browserLang)){
    return browserLang;
  }
  return undefined;
}

function isValidLanguage(language){
  return ((typeof language === "string") && (settings.available_locales.indexOf(language) !== -1));
}

export function getTrans(s, params){
  // First language
  if((typeof LOCALES[settings.locale] !== "undefined") && (typeof LOCALES[settings.locale][s] === "string")){
    return getTransWithParams(LOCALES[settings.locale][s], params);
  }

  // Default language
  if((settings.locale !== settings.default_locale) && (typeof LOCALES[settings.default_locale] !== "undefined") && (typeof LOCALES[settings.default_locale][s] === "string")){
    return getTransWithParams(LOCALES[settings.default_locale][s], params);
  }

  return undefined;
}

/*
 * Replace params (if they are provided) in the translations keys. Example:
 * // "i.dtest"	: "Download #{name}",
 * // getTrans("i.dtest", {name: "SCORM package"}) -> "Download SCORM package"
 */
function getTransWithParams(trans, params){
  if(typeof params !== "object"){
    return trans;
  }

  for(let key in params){
    let stringToReplace = "#{" + key + "}";
    if(trans.indexOf(stringToReplace) !== -1){
      trans = replaceAll(trans, stringToReplace, params[key]);
    }
  }

  return trans;
}

function replaceAll(string, find, replace){
  return string.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
}