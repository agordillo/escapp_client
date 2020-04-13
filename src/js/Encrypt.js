import MD5 from './md5.js';
const SHA_256 = require('js-sha256');

let initialized = false;
let defaultKey = undefined;

export function init(key){
  if(initialized === true){
    return;
  }
  initialized = true;
  defaultKey = key;
};

export function encrypt(value,algorithm,options={}){
  if((typeof value !== "string")||(value.trim()==="")){
    return value;
  }
  switch(algorithm){
    case "MD5":
      return MD5(value);
    case "SHA-256":
      let key = (typeof options.key === "string") ? options.key : defaultKey;
      if((typeof key !== "string")||(key.trim()==="")){
        return value;
      }
      return SHA_256.hmac(key, value);
    default:
      return value;
  }
};