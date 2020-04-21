import * as I18n from './I18n.js';
import * as Utils from './Utils.js';

let initialized = false;
let enabled = false;
let ESCAPP;

let CURRENT_TIME = undefined;
let TIME_RUNOUT = false;
let TIMER = undefined;
let TIMER_NOTIFICATION = undefined;
let RESTART_NOTIFICATION_TIMER = false;

//Constants
let TIMER_DELAY_MAX = 10;
let TIMER_DELAY_MIN = 1;
let CURRENT_TIMER_DELAY = undefined;
let TIMER_DELAY_THRESHOLD = 4*60;
let ER_DURATION;
let NOTIFICATION_TIMES = [0,1,2,5,10,15,30,45,60,90];

export function init(options = {}){
  if(initialized === true){
    return;
  }
  initialized = true;
  enabled = (options.enabled === true);
  ESCAPP = options.escapp;
};

export function startTimer(initTime){
  if((enabled !== true)||(typeof initTime !== "number")||(initTime <= 0)){
    return;
  }
  CURRENT_TIME = initTime;

  // For development
  // CURRENT_TIME = 0*60*60 + 5*60 + 5;

  if(typeof ESCAPP.getSettings().localErState.duration === "number"){
    ER_DURATION = ESCAPP.getSettings().localErState.duration;
  } else {
    ER_DURATION = 2*60*60;
  }

  //Adjust timer
  let timeInHours = CURRENT_TIME/3600;
  let hours = Math.floor(timeInHours);
  let minutes = Math.floor((timeInHours - hours)*60);
  let seconds = CURRENT_TIME - hours * 3600 - minutes * 60;
  CURRENT_TIMER_DELAY = (CURRENT_TIME > TIMER_DELAY_THRESHOLD) ? TIMER_DELAY_MAX : TIMER_DELAY_MIN;
  let adjustingTime = seconds%CURRENT_TIMER_DELAY;

  setTimeout(function(){
    CURRENT_TIME = Math.max(0,CURRENT_TIME - adjustingTime);
    initTimer();
    startNotificationTimer();
  },adjustingTime);
};

function initTimer(){
  if((typeof CURRENT_TIME !== "number")||(CURRENT_TIME <= 0)){
    return;
  }

  if(CURRENT_TIME > TIMER_DELAY_THRESHOLD){
    initTimerDelayMax();
  } else {
    initTimerDelayMin();
  }
};

function initTimerDelayMax(){
  if(typeof TIMER !== "undefined"){
     clearInterval(TIMER);
  }
  CURRENT_TIMER_DELAY = TIMER_DELAY_MAX;
  TIMER = setInterval(function(){
    CURRENT_TIME = Math.max(0,CURRENT_TIME - TIMER_DELAY_MAX);
    if(CURRENT_TIME <= TIMER_DELAY_THRESHOLD){
      initTimerDelayMin();
    }
  },TIMER_DELAY_MAX * 1000);
};

function initTimerDelayMin(){
  if(typeof TIMER !== "undefined"){
     clearInterval(TIMER);
  }
  CURRENT_TIMER_DELAY = TIMER_DELAY_MIN;
  TIMER = setInterval(function(){
    CURRENT_TIME = Math.max(0,CURRENT_TIME - TIMER_DELAY_MIN);
    if(CURRENT_TIME === 0){
      TIME_RUNOUT = true;
      clearInterval(TIMER);
      if(NOTIFICATION_TIMES.indexOf(0)!==-1){
        showNotification();
      }
    }
  },TIMER_DELAY_MIN * 1000);
};

function startNotificationTimer(){
  if((typeof CURRENT_TIME !== "number")||(TIME_RUNOUT === true)){
    return;
  }
  if(typeof TIMER_NOTIFICATION !== "undefined"){
     clearTimeout(TIMER_NOTIFICATION);
  }
  
  let delay = undefined;
  let timeInHours = CURRENT_TIME/3600;
  
  if(timeInHours >= 2){
    //Send notification on next hour
    let hoursToNextHour = (timeInHours - Math.floor(timeInHours));
    delay = hoursToNextHour*3600; //secondsToNextHour
  } else {
    //hoursToNextHour < 2
    let rTimeInMinutes = CURRENT_TIME/60;
    let timesInMinutes = NOTIFICATION_TIMES.sort(function(a,b){return b-a});
    for(let t=0; t<timesInMinutes.length; t++){
      if(rTimeInMinutes >= timesInMinutes[t]){
        delay = (rTimeInMinutes - timesInMinutes[t])*60; //secondsTotimesInMinutes[t]
        break;
      }
    }
  }

  if(typeof delay === "number"){
    TIMER_NOTIFICATION = setTimeout(function(){
      if(TIME_RUNOUT === true){
        return;
      }
      showNotification();
      setTimeout(function(){
        startNotificationTimer();
      },(CURRENT_TIMER_DELAY+1)*1000);
    }, delay*1000);
  }
};

function showNotification(){
  if(typeof CURRENT_TIME !== "number"){
    return;
  }
  if(Math.abs(CURRENT_TIME - ER_DURATION) < 30){
    return;
  }

  let text = undefined;
  let timeInHours = CURRENT_TIME/3600;
  let hours = Math.floor(timeInHours);
  let minutes = Math.round((timeInHours - hours)*60);
  let seconds = CURRENT_TIME - hours * 3600 - minutes * 60;

  if(Math.abs(seconds) <= (CURRENT_TIMER_DELAY+1)){
    if(hours > 0){
      if(minutes === 0){
        //Only hour
        if(hours === 1){
          text = I18n.getTrans("i.notification_time_one_hour");
        } else {
          text = I18n.getTrans("i.notification_time_hours",{hours: hours});
        } 
      } else {
        //Hour and minutes
        text = I18n.getTrans("i.notification_time_hours_and_minutes",{hours: hours, minutes: minutes});
      }
    } else {
      if(minutes > 0){
        //Only minutes
        if(minutes === 1){
          text = I18n.getTrans("i.notification_time_one_minute");
        } else {
          text = I18n.getTrans("i.notification_time_minutes",{minutes: minutes});
        }
      } else if(minutes === 0){
        //Time run out
        if(TIME_RUNOUT === true){
          text = I18n.getTrans("i.notification_time_runout");
        }
      }
    }
  }

  if(typeof text === "string"){
    ESCAPP.displayCustomNotification(text, {type: "time"});
  }
};

function printTime(time){
  let timeInHours = time/3600;
  let hours = Math.floor(timeInHours);
  let minutes = Math.floor((timeInHours - hours)*60);
  let seconds = time - hours * 3600 - minutes * 60;
  console.log("TIME: " + hours + "h " + minutes + "' " + seconds + "''");
};