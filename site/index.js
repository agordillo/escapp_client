let escapp;

$(document).ready(function(){
	console.log("Init escapp with options:");
	if(window['escapp_environment']==="production"){
		CONFIG.imagesPath = "./images/";
	}
	console.log(CONFIG);
	escapp = new ESCAPP(CONFIG);
	loadEvents();
});

let loadEvents = function(){
	$("#validate").click(function(){
		escapp.validate(function(success,er_state){
			if(success===true){
				console.log("Browser validated and user validated (authenticated, authorized and participation verified)");
				console.log("State to restore:");
				console.log(er_state);
			} else {
				console.log("Browser not supported");
			}
		});
	});
	$("#auth").click(function(){
		escapp.validateUser(function(success,er_state){
			console.log("User validated (authenticated, authorized and participation verified)");
			console.log("State to restore:");
			console.log(er_state);
		});
	});
	$("#rstate").click(function(){
		escapp.retrieveState(function(success, er_state){
			if(success===true){
				console.log("State to restore retrieved:");
				console.log(er_state);
			} else {
				console.log("No state is going to be restored.");
			}
		});
	});
	$("#spuzzle").click(function(){
		let puzzle_id = 1;
		let solution = "1234";
		let options = {};
		escapp.submitPuzzle(puzzle_id,solution,options,function(success,res){
			//Puzzle submitted
			console.log("Puzzle submitted");
			console.log("Success: " + success);
			console.log("Full escapp response:");
			console.log(res);
		});
	});
	$("#cedialog").click(function(){
		escapp.displayCustomEscappDialog("Dialog title","Content of the escapp dialog",{},function(){
			//On close dialog callback
		});
	});
	$("#cosdialog").click(function(){
		escapp.displayCompletionDialog({},function(){
			//On close dialog callback
		});
	});
	$("#cdialog").click(function(){
		escapp.displayCustomDialog("Dialog title","Content of the custom dialog",{},function(){
			//On close dialog callback
		});
	});
	$("#pdialog").click(function(){
		let dialogOptions = {};
		// dialogOptions.inputs = [{"type":"password"}];
		escapp.displayPuzzleDialog("Puzzle title","Request puzzle solution",dialogOptions,function(dialogResponse){
			//On close dialog callback
			if(dialogResponse.choice === "ok"){
				console.log("Puzzle solution: " + dialogResponse.value);
			} else {
				console.log("No puzzle solution was specified");
			}
		});
	});
	$("#notification").click(function(){
		escapp.displayCustomEscappNotification("Content of the custom notification",{});
	});
	
	$("#startAnimation").click(function(){
		escapp.startAnimation("confetti");
	});
	$("#stopAnimation").click(function(){
		escapp.stopAnimation("confetti");
	});
	$("#ldata").click(function(){
		escapp.reset(function(){
			console.log("Local data removed");
		});
	});
	$("#rdata").click(function(){
		escapp.displayCustomDialog("Not supported","Remote data remove not supported yet");
	});
	$("#adata").click(function(){
		escapp.displayCustomDialog("Not supported","Remote data remove not supported yet");
	});
	$("#externalApp").click(function(e){
		let appUrl = $("#externalApp").attr("href");
		$("#externalApp").attr("href",escapp.addUserCredentialsToUrl(appUrl));

	});
}