import * as I18n from './I18n.js';
import * as Utils from './Utils.js';
import {io as IO} from 'socket.io-client';

let initialized = false;
let ESCAPP;
let SERVER_URL;
let ESCAPE_ROOM_ID;
let TEAM_ID;
let TEAM_NAME;
let TIME_SECONDARY_NOTIFICATIONS = 4; //In minutes
let DELAY_FOR_RECONNECTIONS = 3000;
let io = IO;
let socket;
let state = {
  connected: false,
  connectedTeamMembers: [],
  reconnectionTeamMembers: {},
  ranking: undefined,
  firstRankingNotificationShown: false,
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
    let protocol = getEscappPlatformSocketProtocol(options.endpoint);
    SERVER_URL = protocol + domain;
    ESCAPE_ROOM_ID = getEscappPlatformERId(options.endpoint);
  }
};

function getEscappPlatformSocketProtocol(endpoint){
  let protocol = "ws://";
  try {
    if (endpoint.match("https://")) {
      protocol = "wss://";
    }
  } catch (e){}
  return protocol;
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
  socket.on('INITIAL_INFO', onInitialInfo);
  socket.on('JOIN', onMemberJoin);
  socket.on('LEAVE', onMemberLeave);
  socket.on('HINT_RESPONSE', onNewHint);
  socket.on('PUZZLE_RESPONSE', onPuzzleResponse);
  //socket.on('PUZZLE_CHECKED', onPuzzleCheck);
  socket.on('TEAM_PROGRESS', onNewRanking);
  socket.on('MESSAGE', onNewMessage);

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
  if(!(settings.localErState.teamMembers instanceof Array)){
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
  if((res.code === "OK")&&(typeof res.puzzleOrder === "number")){
    let puzzlesSolved = Object.assign([],ESCAPP.getNewestState().puzzlesSolved);
    // let settings = ESCAPP.getSettings();
    // if((settings.appPuzzleIds instanceof Array)&&(settings.appPuzzleIds.length > 0)){
    //   puzzlesSolved = puzzlesSolved.filter(puzzle_id => settings.appPuzzleIds.indexOf(puzzle_id)!==-1);
    // }

    ESCAPP.updateRemoteErState(res.erState);

    if(puzzlesSolved.indexOf(res.puzzleOrder)===-1){
      displayOnPuzzleSuccessNotification(res.puzzleOrder);
      setTimeout(function(){
        onNewErState(res.erState);
      },2000);
    } else {
      onNewErState(res.erState);
    }
  }
};

function onPuzzleCheck(res){
  if((res.code === "OK")&&(res.correctAnswer === true)&&(typeof res.puzzleOrder === "number")){
    //Puzzle succesfully checked
    //Do something...
  }
};

function onNewRanking(data){
  if((typeof data === "object")&&(data.ranking instanceof Array)&&(data.ranking.length > 0)){
    updateRanking(data.ranking, data);
  }
};

function onNewMessage(data){
  if (data && data.msg && typeof data.msg === "string" && data.msg.length) {
    let notificationOptions = {type: "info"};
    notificationOptions.text = data.msg;
    ESCAPP.displayCustomNotification(notificationOptions.text, notificationOptions);
  }
}

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

function updateRanking(ranking, eventData){
  let pRanking = undefined;
  if(state.ranking instanceof Array){
    pRanking = Object.assign([],state.ranking);
  }
  //Update previous ranking
  state.ranking = ranking;

  if((!(pRanking instanceof Array))||(!(ranking instanceof Array))||(isRankingEmpty(ranking))){
    return;
  }

  if((typeof TEAM_ID === "undefined")||(typeof TEAM_NAME !== "string")){
    return;
  }

  let prevPosition = getTeamPositionFromRanking(pRanking, TEAM_ID);
  let newPosition = getTeamPositionFromRanking(ranking, TEAM_ID);
  
  if((typeof prevPosition !== "number")||(typeof newPosition !== "number")){
    return;
  }

  let positionUp = (newPosition < prevPosition);
  let samePosition = (newPosition === prevPosition);
  let positionDown = (newPosition > prevPosition);

  let team = ESCAPP.getTeamFromRanking(TEAM_ID,ranking);
  let puzzlesSolved = ((typeof team === "object")&&(typeof team.count === "number")) ? team.count : 0;
  
  let notificationMessage = undefined;
  let teamNotification = TEAM_ID;

  if((state.firstRankingNotificationShown===false)&&(puzzlesSolved > 0)&&((samePosition)||(positionDown))){
    positionUp = (newPosition <= 3);
    samePosition = false;
    positionDown = false;
  }

  //Podium messages
  let podiumMessage = false;
  if(((puzzlesSolved > 0)&&(newPosition <= 3))){
    switch(newPosition){
      case 1:
        if(positionUp){
          notificationMessage = I18n.getTrans("i.notification_ranking_1_up", {team: TEAM_NAME});
        } else if(samePosition){
          notificationMessage = I18n.getTrans("i.notification_ranking_1_same", {team: TEAM_NAME});
        }
        break;
      case 2:
        if(positionUp){
          notificationMessage = I18n.getTrans("i.notification_ranking_2_up", {team: TEAM_NAME});
        } else if(samePosition){
          notificationMessage = I18n.getTrans("i.notification_ranking_2_same", {team: TEAM_NAME});
        } else if(positionDown){
          notificationMessage = I18n.getTrans("i.notification_ranking_2_down", {teamOther: ranking[0].name, team: TEAM_NAME});
        }
        break;
      case 3:
        if(positionUp){
          notificationMessage = I18n.getTrans("i.notification_ranking_3_up", {team: TEAM_NAME});
        } else if(samePosition){
          notificationMessage = I18n.getTrans("i.notification_ranking_3_same", {team: TEAM_NAME});
        } else if(positionDown){
          let teamOther;
          if((pRanking.length > 0)&&(pRanking[0].id !== ranking[0].id)){
            teamOther = ranking[0].name;
          } else {
            teamOther = ranking[1].name;
          }
          notificationMessage = I18n.getTrans("i.notification_ranking_3_down", {teamOther: teamOther, team: TEAM_NAME});
        }
        break;
      default:
        break;
    }

    podiumMessage = (typeof notificationMessage === "string");
  } 

  if(typeof notificationMessage === "undefined"){
    if((positionUp)&&(puzzlesSolved > 0)){
      notificationMessage = I18n.getTrans("i.notification_ranking_up", {team: TEAM_NAME, position: newPosition});
    } else if((positionDown)&&(puzzlesSolved > 0)){
      let teamOther = getTeamOtherWhenRankingDown(pRanking,ranking,prevPosition,newPosition);
      if(typeof teamOther === "string"){
        notificationMessage = I18n.getTrans("i.notification_ranking_down", {teamOther: teamOther, team: TEAM_NAME, position: newPosition});
      } else {
        notificationMessage = I18n.getTrans("i.notification_ranking_down_generic", {team: TEAM_NAME, position: newPosition});
      }
    } else {
      //Team has puzzlesSolved===0 or (team is not in the podium and team has the same position)

      if((state.firstRankingNotificationShown === true)||(puzzlesSolved === 0)){
        //Check for changes in the podium (only other teams)
        if(pRanking instanceof Array){
          let pRL = pRanking.length;
          let rL = ranking.length;
          if((pRL > 0)&&(rL > 0)){
            if((pRanking[0].id !== ranking[0].id)&&(ranking[0].id !== TEAM_ID)){
              //New team in the first position
              teamNotification = ranking[0].id;
              notificationMessage = I18n.getTrans("i.notification_ranking_1_other", {teamOther: ranking[0].name});
            } else if((pRL > 1)&&(rL > 1)){
              if((pRanking[1].id !== ranking[1].id)&&(ranking[1].id !== TEAM_ID)){
                //New team in the 2nd position
                teamNotification = ranking[1].id;
                notificationMessage = I18n.getTrans("i.notification_ranking_2_other", {teamOther: ranking[1].name});
              } else if((pRL > 2)&&(rL > 2)){
                if((pRanking[2].id !== ranking[2].id)&&(ranking[2].id !== TEAM_ID)){
                  //New team in the 3nd position
                  teamNotification = ranking[2].id;
                  notificationMessage = I18n.getTrans("i.notification_ranking_3_other", {teamOther: ranking[2].name});
                }
              }
            }
          }
        } 
      }

      //Generic ranking message. Notifies current team position
      if(typeof notificationMessage === "undefined"){
        notificationMessage = I18n.getTrans("i.notification_ranking_generic", {team: TEAM_NAME, position: newPosition});
      }
    }
  }

  let outOfPodiumMessage = ((positionDown===true)&&(puzzlesSolved > 0)&&(prevPosition <= 3)&&(newPosition > 3));
  let isSecondaryNotification = ((samePosition===true)||(teamNotification !== TEAM_ID)||((positionDown===true)&&(podiumMessage===false)&&(outOfPodiumMessage===false)));

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

    if((state.firstRankingNotificationShown === false)&&(teamNotification === TEAM_ID)){
      state.firstRankingNotificationShown = true;
    }

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

function getTeamPositionFromRanking(ranking, teamId){
  if((typeof teamId === "number")&&(ranking instanceof Array)){
    for(let i=0; i<ranking.length; i++){
      if(ranking[i].id === teamId){
        return i+1;
      }
    }
  }
  return undefined;
};

function getTeamOtherWhenRankingDown(prevRanking, ranking, prevPosition, newPosition){
  if((prevPosition <= 0)||(newPosition <= prevPosition)||(prevPosition >= prevRanking.length)||(newPosition > ranking.length)){
    return undefined;
  }

  let prevTeamsDown = [];
  for(let i=prevPosition; i<prevRanking.length; i++){
    prevTeamsDown.push(prevRanking[i].id);
  }

  if(prevTeamsDown.length === 0){
    return undefined;
  }

  let newTeamsUpNames = [];
  for(let j=(newPosition-1); j>=0; j--){
    if(prevTeamsDown.indexOf(ranking[j].id)!==-1){
      newTeamsUpNames.push(ranking[j].name);
    }
  }

  if(newTeamsUpNames.length === 1){
    return newTeamsUpNames[0];
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