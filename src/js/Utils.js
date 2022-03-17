export function deepMerge(h1,h2){
  if((typeof h1 === "object")&&(typeof h2 === "object")&&(!(h1 instanceof Array))){
    let keys = Object.keys(Object.assign({},h1,h2));
    let keysL = keys.length;
    for(let i=0; i<keysL; i++){
      h1[keys[i]] = deepMerge(h1[keys[i]],h2[keys[i]]);
    }
    return h1;
  } else {
    if(typeof h2 !== "undefined"){
      return h2;
    } else {
      return h1;
    }
  }
};

export function getParamsFromCurrentUrl(){
  try {
    let url = window.location.href;
    return getParamsFromUrl(url);
  } catch (e){
    return {};
  }; 
};

export function getParamsFromUrl(url){
  let params = {};
  if(typeof url !== "string"){
    return params;
  }
  let split = url.split("?");
  if(split.length<=1){
    return params;
  } else {
    //Remove hash if present
    let urlParams = split[1].split("#")[0].split("&");
    for(let i=0; i<urlParams.length; i++){
      let resultSplit = urlParams[i].split("=");
      if(resultSplit.length===2){
        //key-value pairs
        params[resultSplit[0]] = decodeURIComponent(resultSplit[1]);
      }
    }
    return params;
  }
};

export function addParamToUrl(url,paramName,paramValue){
  if((typeof url !== "string")||(typeof paramName !== "string")||(typeof paramValue !== "string")){
    return url;
  }

  //Remove hash
  var splitHash = url.split("#");
  url = splitHash[0];

  var param = paramName + "=" + encodeURIComponent(paramValue);
  if (url.indexOf('?') > -1){
    url += '&'+param;
  }else{
    url += '?'+param;
  }

  //Add hash (if present)
  if(splitHash.length>1){
    url = url + "#" + splitHash[1];
  }
  
  return url;
};

export function checkUrlProtocol(url){
  if(typeof url == "string"){
    var protocolMatch = (url).match(/^https?:\/\//);
    if((protocolMatch instanceof Array)&&(protocolMatch.length === 1)){
      var urlProtocol = protocolMatch[0].replace(":\/\/","");
      var appProtocol = getProtocol();
      if(urlProtocol != appProtocol){
        switch(appProtocol){
          case "https":
            //Try to load HTTP url over HTTPs
            url = "https" + url.replace(urlProtocol,""); //replace first
            break;
          case "http":
            //Try to load HTTPs url over HTTP
            //Do nothing
            break;
          default:
            //App is not loaded over HTTP or HTTPs
            break;
        }
      }
    }
  }
  return url;
};

var getProtocol = function(){
  var protocol;
  try {
    protocol = document.location.protocol;
  } catch(e){}

  if(typeof protocol == "string"){
    var protocolMatch = protocol.match(/[\w]+/);
    if((protocolMatch instanceof Array)&&(typeof protocolMatch[0] == "string")){
      protocol = protocolMatch[0];
    } else {
      protocol = "unknown";
    }
  }
  return protocol;
}

export function validateEmail(email){
	if(typeof email !== "string") return false;
	var regex = /\S+@\S+\.\S+/;
	return regex.test(email);
};

export function validateString(str){
  return ((typeof str === "string")&&(str.trim()!==""));
};

export function generateRandomNumber(min,max){
  return Math.floor(Math.random()*(max-min+1)+min);
};

let isEmbedCache;
export function isEmbed(){
  if(typeof isEmbedCache === "boolean"){
    return isEmbedCache;
  }

  let _isEmbed = true;
  try {
    _isEmbed = (window.location !== window.parent.location);
  } catch(e){}

  isEmbedCache = _isEmbed;
  return _isEmbed;
};

export function debug(msg){
  if(typeof msg === "object"){
    console.log("ESCAPP: [Object]");
    console.log(msg);
  } else {
    console.log("ESCAPP: " + msg);
  }
};