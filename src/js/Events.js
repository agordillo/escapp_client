import * as Notifications from './Notifications.js';
import * as I18n from './I18n.js';

let initialized = false;

export function init(options){
	if(initialized === true){
		return;
	}
	initialized = true;
}