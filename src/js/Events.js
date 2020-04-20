import * as I18n from './I18n.js';
import * as Utils from './Utils.js';
import IO from './socket.io';

let initialized = false;
let ESCAPP;
let SERVER_URL;
let ESCAPE_ROOM_ID;
let TEAM_ID;
let TEAM_NAME;
let TIME_SECONDARY_NOTIFICATIONS;
let DELAY_FOR_RECONNECTIONS = 3000;
let io = IO;
let socket;
let state = {
  connected: false,
  connectedTeamMembers: [],
  reconnectionTeamMembers: {},
  ranking: undefined,
  allowSecondaryRankingNotifications: true,
}

export function init(options = {}){
  if(initialized === true){
    return;
  }
  initialized = true;
  ESCAPP = options.escapp;

  let domain = getEscappPlatformDomain(options.endpoint);
  if(typeof domain !== "undefined"){
    SERVER_URL = 'wss://' + getEscappPlatformDomain(options.endpoint);
    ESCAPE_ROOM_ID = getEscappPlatformERId(options.endpoint);
  }
}

function getEscappPlatformDomain(endpoint){
  let domain;
  try {
    domain = endpoint.split("/")[2];
  } catch (e){}
  return domain;
};

function getEscappPlatformERId(endpoint){
  return endpoint.split("/").pop();
};


/////////////////////
// Socket management
/////////////////////

export function connect(userCredentials,initialSettings){
  if(state.connected===true){
    //Prevent multiple connections
    return;
  }

  TEAM_ID = initialSettings.localErState.teamId;
  TEAM_NAME = initialSettings.teamName;
  TIME_SECONDARY_NOTIFICATIONS = initialSettings.timeSecondaryNotifications;
  state.ranking = initialSettings.localErState.ranking;

  let connectionQuery = {
    "escapeRoom": ESCAPE_ROOM_ID,
    "email": userCredentials.email,
    "token": userCredentials.token
  };
  socket = io(SERVER_URL, {query: connectionQuery});
  loadSocketEvents(socket);
};

function loadSocketEvents(socket){
  socket.on("connect",onConnect);
  socket.on("disconnect", onDisconnect);
  socket.on('INITIAL_INFO', onInitialInfo);
  socket.on('JOIN', onMemberJoin);
  socket.on('LEAVE', onMemberLeave);
  socket.on('HINT_RESPONSE', onNewHint);
  socket.on('PUZZLE_RESPONSE', onPuzzleResponse);
  socket.on('TEAM_PROGRESS', onNewRanking);

  //Socket IO generic errors
  socket.on('connect_error', (err) => {
    // console.log("SocketIO: connect_error");
  });
  socket.on("error", (err)=>{
    // console.log("SocketIO: error");
  });
};


/////////////////////
// Socket Escapp events
/////////////////////

function onConnect(){
  state.connected = true;
  // console.log("OnConnected");
};

function onInitialInfo(data){
  if(data.connectedMembers instanceof Array){
    state.connectedTeamMembers = data.connectedMembers;
  }
};

function onDisconnect(){
  state.connected = false;
  // console.log("OnDisconnected");
};

function onMemberJoin(data){
  if((typeof data !== "object")||(typeof data.username !== "string")){
    return;
  }

  let previousConnectedTeamMembers = Object.assign([],state.connectedTeamMembers);
  if(data.connectedMembers instanceof Array){
    state.connectedTeamMembers = data.connectedMembers;
  }

  //A new member of my team joined the Escape Room
  let memberEmail = data.username;
  let settings = ESCAPP.getSettings();

  if(memberEmail === settings.user.email){
    return;
  }

  if(settings.localErState.teamMembers.indexOf(memberEmail) !== -1){
    if(previousConnectedTeamMembers.indexOf(memberEmail) === -1){
      if(typeof state.reconnectionTeamMembers[memberEmail] === "undefined"){
        let memberName = ESCAPP.getMemberNameFromERState(settings.localErState,memberEmail);
        if(typeof memberName === "string"){
          displayOnMemberJoinNotification(memberName);
        }
      }
    }
  }
};

function onMemberLeave(data){
  if((typeof data !== "object")||(typeof data.username !== "string")){
    return;
  }

  let previousConnectedTeamMembers = Object.assign([],state.connectedTeamMembers);
  if(data.connectedMembers instanceof Array){
    state.connectedTeamMembers = data.connectedMembers;
  }

  //A member of my team left the Escape Room
  let memberEmail = data.username;
  let settings = ESCAPP.getSettings();

  if(memberEmail === settings.user.email){
    return;
  }

  if(settings.localErState.teamMembers.indexOf(memberEmail) !== -1){
    if(previousConnectedTeamMembers.indexOf(memberEmail) !== -1){
      if(state.connectedTeamMembers.indexOf(memberEmail) === -1){
        if(typeof state.reconnectionTeamMembers[memberEmail] === "number"){
          state.reconnectionTeamMembers[memberEmail] = state.reconnectionTeamMembers[memberEmail] + 1;
        } else {
          state.reconnectionTeamMembers[memberEmail] = 1;
        }
        setTimeout(function(){
          //Do not show leave messages on reconnections
          if(typeof state.reconnectionTeamMembers[memberEmail] === "number"){
            state.reconnectionTeamMembers[memberEmail] = state.reconnectionTeamMembers[memberEmail] - 1;
            if(state.reconnectionTeamMembers[memberEmail] === 0){
              delete state.reconnectionTeamMembers[memberEmail];
            }
          }
          if(state.connectedTeamMembers.indexOf(memberEmail) === -1){
            if(typeof state.reconnectionTeamMembers[memberEmail] === "undefined"){
              let memberName = ESCAPP.getMemberNameFromERState(settings.localErState,memberEmail);
              if(typeof memberName === "string"){
                displayOnMemberLeaveNotification(memberName);
              }
            }
          }
        }, DELAY_FOR_RECONNECTIONS);
      }
    }
  }
};

function onNewHint(res){
  if(typeof res.msg !== "string"){
    return;
  }
  //My team obtained a new hint
  let hint = res.msg;
  displayOnNewHintNotification(hint);
};

function onPuzzleResponse(res){
  if(res.code === "OK"){
    ESCAPP.updateRemoteErState(res.erState);
    displayOnPuzzleSuccessNotification();
    setTimeout(function(){
      onNewErState(res.erState);
    },2000);
  }
};

function onNewRanking(data){
  if((typeof data === "object")&&(data.ranking instanceof Array)){
    updateRanking(data.ranking);
  }
};


//////////////////
// Utils for managing escapp events
//////////////////

function onNewErState(erState){
  let localErStateBeforeEvent = Object.assign({},ESCAPP.getSettings().localErState);
  let isRemoteStateNewestForApp = ESCAPP.isRemoteStateNewestForApp();
  ESCAPP.validateStateToRestore(function(erState){
    if(typeof erState === "object"){
      if((isRemoteStateNewestForApp)&&(ESCAPP.isStateNewestThan(erState,localErStateBeforeEvent))){
        if(typeof ESCAPP.getSettings().onNewErStateCallback === "function"){
          ESCAPP.getSettings().onNewErStateCallback(erState);
        }
      }
    }
  });
};

function updateRanking(ranking){
  let pRanking = undefined;
  if(typeof state.ranking !== "undefined"){
    pRanking = Object.assign([],state.ranking);
  }
  //Update previous ranking
  state.ranking = ranking;

  if(isRankingEmpty(ranking)){
    return;
  }

  let prevPosition = getTeamPositionFromRanking(pRanking);
  let newPosition = getTeamPositionFromRanking(ranking);

  if((typeof newPosition !== "number")||(typeof TEAM_NAME !== "string")){
    return;
  }

  let differentPosition = (newPosition !== prevPosition);
  let betterPosition = (newPosition > prevPosition);

  let notificationMessage = undefined;
  let isSecondaryNotification = (betterPosition===false);

  switch(newPosition){
    case 1:
      notificationMessage = I18n.getTrans("i.notification_ranking_1", {team: TEAM_NAME, position: newPosition});
      break;
    case 2:
      notificationMessage = I18n.getTrans("i.notification_ranking_2", {team: TEAM_NAME, position: newPosition});
      break;
    case 3:
      notificationMessage = I18n.getTrans("i.notification_ranking_3", {team: TEAM_NAME, position: newPosition});
      break;
    default:
      if(betterPosition){
        notificationMessage = I18n.getTrans("i.notification_ranking_up", {team: TEAM_NAME, position: newPosition});
      } else if(differentPosition){
        notificationMessage = I18n.getTrans("i.notification_ranking_down", {team: TEAM_NAME, position: newPosition});
      } else {
        //prevPosition === newPosition
        notificationMessage = I18n.getTrans("i.notification_ranking_same", {team: TEAM_NAME, position: newPosition});
      }
      break;
  }

  if(isSecondaryNotification){
    //Prevent notification overflood
    if(state.allowSecondaryRankingNotifications === false){
      notificationMessage = undefined;
    }
  }
  
  if(typeof notificationMessage === "string"){
    state.allowSecondaryRankingNotifications = false;
    setTimeout(function(){
      state.allowSecondaryRankingNotifications = true;
    },TIME_SECONDARY_NOTIFICATIONS * 60000);
    displayRankingNotification(notificationMessage);
  }
};

function isRankingEmpty(ranking){
  if(ranking instanceof Array){
    for(let i=0; i<ranking.length; i++){
      if(ranking[i].count > 0){
        return false;
      }
    }
  }
  return true;
};

function getTeamPositionFromRanking(ranking){
  if((typeof TEAM_ID === "number")&&(ranking instanceof Array)){
    for(let i=0; i<ranking.length; i++){
      if(ranking[i].id === TEAM_ID){
        return i+1;
      }
    }
  }
  return undefined;
};


///////////////
// Notifications
///////////////

function displayOnMemberJoinNotification(memberName){
  let notificationOptions = {type: "info"};
  notificationOptions.text = I18n.getTrans("i.notification_member_join", {member: memberName});
  ESCAPP.displayCustomNotification(notificationOptions.text, notificationOptions);
};

function displayOnMemberLeaveNotification(memberName){
  let notificationOptions = {type: "info"};
  notificationOptions.text = I18n.getTrans("i.notification_member_leave", {member: memberName});
  ESCAPP.displayCustomNotification(notificationOptions.text, notificationOptions);
};

function displayOnNewHintNotification(hint){
  let notificationOptions = {type: "event", autoHide: true};
  notificationOptions.text = I18n.getTrans("i.notification_hint_new", {hint: hint});
  ESCAPP.displayCustomNotification(notificationOptions.text, notificationOptions);
};

function displayOnPuzzleSuccessNotification(puzzle){
  let notificationOptions = {type: "event"};
  let rndEndMessage = Utils.generateRandomNumber(1,3);
  notificationOptions.text = I18n.getTrans("i.notification_puzzle_success", {puzzle: puzzle}) + " " + I18n.getTrans(("i.notification_puzzle_success_end" + rndEndMessage), {team: TEAM_NAME});
  ESCAPP.displayCustomNotification(notificationOptions.text, notificationOptions);
};

function displayRankingNotification(msg){
  let notificationOptions = {type: "ranking"};
  ESCAPP.displayCustomNotification(msg, notificationOptions);
};