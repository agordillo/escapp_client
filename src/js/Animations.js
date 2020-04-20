import './jquery-3.4.0.min.js';
import * as Confetti from './animations/Confetti.js';
import * as Birds from './animations/Birds.js';
import * as I18n from './I18n.js';

let initialized = false;
let startedAnimations = [];
let imagesPath;

export function init(options){
	if(initialized === true){
		return;
	}
	initialized = true;
	imagesPath = options.imagesPath || "/assets/images/";
};

export function startAnimation(animation,time){
	let started = true;
	switch(animation){
	case "confetti":
		Confetti.startConfetti();
		break;
	case "birds":
		Birds.start(imagesPath);
		break;
	default:
		started = false;
		break;
	}

	if(started === false){
		return;
	}
	
	if(startedAnimations.indexOf(animation)===-1){
		startedAnimations.push(animation);
	}
	if(typeof time === "number"){
		setTimeout(function(){
			this.stopAnimation(animation);
		}.bind(this),time);
	}
};

export function stopAnimation(animation){
	let aIndex = startedAnimations.indexOf(animation);
	if(aIndex === -1){
		return;
	}

	switch(animation){
	case "confetti":
		Confetti.stopConfetti();
		break;
	case "birds":
		Birds.stop();
		break;
	default:
		break;
	}
	
	startedAnimations.splice(aIndex,1);
};