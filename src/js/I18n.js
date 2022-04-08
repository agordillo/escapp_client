import * as Utils from './Utils.js';
import {ESCAPP_LOCALES} from './locales.js';

let LOCALES;
let settings;

export function init(options){
  if(typeof LOCALES !== "undefined"){
    //Already initialized
    return;
  }

  //Default options
  let defaults = {
    availableLocales: ["es","en"],
    defaultLocale: "en",
    locale: undefined,
  };

  // Settings merged with defaults and extended options
  settings = Utils.deepMerge(defaults, options);

  //Set hardcoded locales and merge with config locales
  LOCALES = ESCAPP_LOCALES;
  if(typeof options.locales === "object"){
    LOCALES = Utils.deepMerge(LOCALES, options.locales);
    delete settings.locales;
  }

  // Set default locale
  if(isValidLocale(settings.defaultLocale) === false){
    if((typeof settings.availableLocales !== "undefined")&&(settings.availableLocales instanceof Array)&&(settings.availableLocales.length > 0)){
      settings.defaultLocale = settings.availableLocales[0];
    } else {
      settings.defaultLocale = defaults.defaultLocale;
    }
  }

  // Set locale (1. Force by config, 2. URL, 3. Web browser)
  if(isValidLocale(settings.locale)===false){
    let uL = getUserLocale();
    if(isValidLocale(uL)){
      settings.locale = uL;
    } else {
      settings.locale = settings.defaultLocale;
    }
  }
}

export function getLocale(){
  return settings.locale;
}

function getUserLocale(){
  // Locale in URL
  let urlParams = Utils.getParamsFromCurrentUrl();
  if(isValidLocale(urlParams.locale)){
    return urlParams.locale;
  }
  // Browser language
  let browserLang = (navigator.language || navigator.userLanguage);
  if((typeof browserLang === "string")&&(browserLang.indexOf("-") !== -1)){
    browserLang = browserLang.split("-")[0];
  }
  if(isValidLocale(browserLang)){
    return browserLang;
  }
  return undefined;
}

function isValidLocale(locale){
  return ((typeof locale === "string") && (settings.availableLocales.indexOf(locale) !== -1));
}

export function getTrans(s, params){
  // First locale
  if((typeof LOCALES[settings.locale] !== "undefined") && (typeof LOCALES[settings.locale][s] === "string")){
    return getTransWithParams(LOCALES[settings.locale][s], params);
  }

  // Default locale
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
      trans = Utils.replaceAll(trans, stringToReplace, params[key]);
    }
  }

  return trans;
}