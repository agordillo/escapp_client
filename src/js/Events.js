import * as Notifications from './Notifications.js';
import * as I18n from './I18n.js';
import IO from './socket.io';

let initialized = false;
let SERVER_URL;
let ESCAPE_ROOM_ID;
let io = IO;
let socket;
let connected = false;

export function init(options){
  if(initialized === true){
    return;
  }
  initialized = true;
  Notifications.init({imagesPath: options.imagesPath});

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

export function connect(userCredentials){
  let connectionQuery = {
    "escapeRoom": ESCAPE_ROOM_ID,
    "email": userCredentials.email,
    "token": userCredentials.token
  };
  socket = io(SERVER_URL, {query: connectionQuery});
  loadSocketEvents(socket);
}

function loadSocketEvents(socket){
  socket.on("connect",onConnect);
  socket.on("disconnect", onDisconnect);
  socket.on('JOIN', onMemberJoin);
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
}

function onConnect(){
  connected = true;
}

function onDisconnect(){
  connected = false;
}

function onMemberJoin(username){
  console.log("onMemberJoin");
}

function onNewHint(code, authentication, participation, hintOrder, puzzleOrder, category, msg){
  console.log("onNewHint");
}

function onPuzzleResponse(code, correctAnswer, puzzleOrder, participation, authentication, msg, erState){
  console.log("onPuzzleResponse");
}

function onNewRanking(teamId, puzzleOrder, ranking){
  console.log("onNewRanking");
}