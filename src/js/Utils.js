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
        params[resultSplit[0]] = resultSplit[1];
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

  var param = paramName+"="+paramValue;
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

export function validateEmail(email){
	if(typeof email !== "string") return false;
	var regex = /\S+@\S+\.\S+/;
	return regex.test(email);
};

export function debug(msg){
  if(typeof msg === "object"){
    console.log("ESCAPP: [Object]");
    console.log(msg);
  } else {
    console.log("ESCAPP: " + msg);
  }
};