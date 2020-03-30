let ls_supported = false;
let storageKey;

export function init(lsStorageKey){
  if(typeof storageKey !== "undefined"){
    return; //prevent multiple inits
  }
  storageKey = lsStorageKey;
  ls_supported = isSupported();
  return ls_supported;
}

export function isSupported(){
  return (!!window.localStorage
    && typeof localStorage.getItem === 'function'
    && typeof localStorage.setItem === 'function'
    && typeof localStorage.removeItem === 'function');
}

function getData(){
  if(ls_supported === false){
    return {};
  }
  let storedData = localStorage.getItem(storageKey);
  if((typeof storedData === "undefined")||(storedData === null)){
    return {};
  }
  try {
    return JSON.parse(storedData);
  } catch (e){
    return {};
  }
}

function saveData(data){
  if(ls_supported === false){
    return undefined;
  }
  try {
    data = JSON.stringify(data);
    localStorage.setItem(storageKey,data);
  } catch (e){
    return undefined;
  }
  return data;
}

export function getSetting(settingName){
  if(ls_supported === false){
    return undefined;
  }
  let data = getData();
  if(typeof data === "object"){
    return data[settingName];
  }
  return undefined;
}

export function saveSetting(settingName,value){
  if(ls_supported === false){
    return undefined;
  }
  let data = getData();
  if(typeof data === "object"){
    data[settingName] = value;
    return saveData(data);
  }
  return undefined;
}

export function removeSetting(settingName){
  if(ls_supported === false){
    return undefined;
  }
  let data = getData();
  if(typeof data === "object"){
    delete data[settingName];
    return saveData(data);
  }
  return undefined;
}

export function clear(){
  if(ls_supported === false){
    return undefined;
  }
  localStorage.removeItem(storageKey);
  return undefined;
}