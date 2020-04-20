import * as Utils from './Utils.js';
import {ESCAPP_LOCALES} from './locales.js';

let LOCALES = ESCAPP_LOCALES;
let settings;

export function init(options){
  if(typeof locale !== "undefined"){
    //Already initialized
    return;
  }

  //Default options
  let defaults = {
    locale: undefined,
    defaultLocale: "en",
    availableLocales: ["es","en"],
  };

  // Settings merged with defaults and extended options
  settings = Utils.deepMerge(defaults, options);
  if(typeof options.locales === "object"){
    LOCALES = Utils.deepMerge(LOCALES, options.locales);
    delete settings.locales;
  }

  // Set default locale
  if((typeof settings.availableLocales !== "undefined") && (settings.availableLocales instanceof Array) && (settings.availableLocales.length > 0)){
    settings.defaultLocale = settings.availableLocales[0]; // Default language
  }

  // Set locale
  if(isValidLanguage(settings.locale)===false){
    let uL = getUserLanguage();
    if(isValidLanguage(uL)){
      settings.locale = uL;
    } else {
      settings.locale = settings.defaultLocale;
    }
  }
}

export function getLanguage(){
  return settings.locale;
}

function getUserLanguage(){
  // Locale in URL
  let urlParams = Utils.getParamsFromCurrentUrl();
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
  return ((typeof language === "string") && (settings.availableLocales.indexOf(language) !== -1));
}

export function getTrans(s, params){
  // First language
  if((typeof LOCALES[settings.locale] !== "undefined") && (typeof LOCALES[settings.locale][s] === "string")){
    return getTransWithParams(LOCALES[settings.locale][s], params);
  }

  // Default language
  if((settings.locale !== settings.defaultLocale) && (typeof LOCALES[settings.defaultLocale] !== "undefined") && (typeof LOCALES[settings.defaultLocale][s] === "string")){
    return getTransWithParams(LOCALES[settings.defaultLocale][s], params);
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