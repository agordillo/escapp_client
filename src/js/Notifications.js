import * as Utils from './Utils.js';
import * as I18n from './I18n.js';
import './jquery-3.4.0.min.js';
import './notify.js';
import '../css/notifications.scss';

let initialized = false;
let imagesPath;

export function init(options){
	if(initialized === true){
		return;
	}
	initialized = true;
	imagesPath = options.imagesPath || "/assets/images/";
}

export function displayNotification(options = {}){
	displayRankingNotification("Primero", options);
}

export function _displayNotification(options = {}){
	options = Utils.deepMerge({
		clickToHide: true,
		autoHide: false,
		autoHideDelay: 5000
	},options);
	
	if(["success","info","warn","error","ranking"].indexOf(options.className)===-1){
		options.className = "info";
	}

	$.notify(options.text, options);
}

export function displayRankingNotification(text, options = {}){
	let notificationOptions = Utils.deepMerge(options,{
		text: text,
		className: "ranking",
		clickToHide: true,
		autoHide: false,
		autoHideDelay: 5000,
		globalPosition: 'top right',
		showAnimation: 'fadeIn',
		showDuration: 600,
		hideAnimation: 'fadeOut',
		hideDuration: 300,
		gap: 0
	});
	
	return _displayNotification(notificationOptions);
}