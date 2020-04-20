import * as I18n from './I18n.js';
import * as Utils from './Utils.js';
import IO from './socket.io';

let initialized = false;
let ESCAPP;
let SERVER_URL;
let ESCAPE_ROOM_ID;
let TEAM_ID;
let TEAM_NAME;
let io = IO;
let socket;
let state = {
  connected: false,
  connectedTeamMembers: {},
  ranking: undefined,
  allowSecondaryNotifications: true,
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

function onDisconnect(){
  state.connected = false;
  // console.log("OnDisconnected");
};

function onMemberJoin(member){
  if((typeof member !== "object")||(typeof member.username !== "string")){
    return;
  }

  //A new member of my team joined the Escape Room
  let memberEmail = member.username;
  let settings = ESCAPP.getSettings();

  if(settings.localErState.teamMembers.indexOf(memberEmail)!==-1){
    if(typeof state.connectedTeamMembers[memberEmail] === "undefined"){
      state.connectedTeamMembers[memberEmail] = 1;
      let memberName = ESCAPP.getMemberNameFromERState(settings.localErState,memberEmail);
      displayOnMemberJoinNotification(memberName);
    } else if(typeof state.connectedTeamMembers[memberEmail] === "number"){
      state.connectedTeamMembers[memberEmail] = state.connectedTeamMembers[memberEmail] + 1;
    }
  }
};

function onMemberLeave(member){
  if((typeof member !== "object")||(typeof member.username !== "string")){
    return;
  }

  //A member of my team left the Escape Room
  let memberEmail = member.username;
  let settings = ESCAPP.getSettings();

  if(settings.localErState.teamMembers.indexOf(memberEmail)!==-1){
    if(typeof state.connectedTeamMembers[memberEmail] === "number"){
      state.connectedTeamMembers[memberEmail] = state.connectedTeamMembers[memberEmail] - 1;
      if(state.connectedTeamMembers[memberEmail] === 0){
        delete state.connectedTeamMembers[memberEmail];
        let memberName = ESCAPP.getMemberNameFromERState(settings.localErState,memberEmail);
        displayOnMemberLeaveNotification(memberName);
      }
    } else if(typeof state.connectedTeamMembers[memberEmail] === "undefined"){
      //Do nothing
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
  let erStateBeforeEvent = Object.assign({},ESCAPP.getSettings().localErState);
  ESCAPP.validateStateToRestore(function(erState){
    if(typeof erState === "object"){
      if(ESCAPP.isStateNewestThan(erState,erStateBeforeEvent)){
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

  if(typeof newPosition !== "number"){
    return;
  }

  let notificationMessage = undefined;

  if(prevPosition !== newPosition){
    let betterPosition = (newPosition > prevPosition);
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
        } else {
          notificationMessage = I18n.getTrans("i.notification_ranking_down", {team: TEAM_NAME, position: newPosition});
        }
        break;
    }

    if(betterPosition===false){
      //Prevent notification overflood
      if(state.allowSecondaryNotifications === false){
        notificationMessage = undefined;
      }
    }
  }

  if(typeof notificationMessage === "string"){
    state.allowSecondaryNotifications = false;
    setTimeout(function(){
      state.allowSecondaryNotifications = true;
    },60000);
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