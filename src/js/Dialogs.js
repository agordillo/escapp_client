import '../css/modal.scss';
import './jquery-3.4.0.min.js';
import * as I18n from './I18n.js';
import MicroModal from './MicroModal.js';

let initialized = false;
let imagesPath;

export function init(options){
	if(initialized === true){
		return;
	}
	initialized = true;
	imagesPath = options.imagesPath || "/assets/images/";
    let modalHTMLcode = '<div class="modal micromodal-slide" id="modal" aria-hidden="true"><div class="modal__overlay" tabIndex="-1"><div class="modal__container" role="dialog" aria-modal="true"><header class="modal__header"><h2 class="modal__title" id="modal-title"></h2></header><main class="modal__content" id="modal-content"><p class="content"></p></main><footer class="modal__footer"></footer></div></div>';
    $("body").prepend(modalHTMLcode);
    $("#modal div.modal__container").prepend('<img class="escapp_img" src="' + imagesPath + 'escapp_logo_dark.png"/>');
	MicroModal.init({
	  disableScroll: true,
	  disableFocus: false,
	  awaitOpenAnimation: false,
	  awaitCloseAnimation: false,
	  debugMode: false
	});
}

export function displayDialog(options){
	if($("#modal").hasClass("is-open")){
		MicroModal.close('modal', {
			onClose: function(modal,response){
				setTimeout(function(){
					displayDialog(options);
				},50);
			}
		});
		return;
	}

	//Fill data
	$("#modal-title").html(options.title);
	$("#modal-content p.content").html(options.text);
	$(".modal-input").remove();

	if((options.inputs instanceof Array)&&(options.inputs.length > 0)){
		for(var i=0; i<options.inputs.length; i++){
			$("#modal-content").append('<p><input id="modal-input' + (i+1) + '" class="modal-input" type="text"/></p>');
			if(typeof options.inputs[i].type === "string"){
				$("#modal-input" + (i+1)).attr("type",options.inputs[i].type);
			}
			if(typeof options.inputs[i].label === "string"){
				$("#modal-input" + (i+1)).attr("placeholder",options.inputs[i].label);
			}
		}
	}

	$("footer.modal__footer .modal__btn").remove();
	if(options.buttons instanceof Array){
		for(var j=options.buttons.length-1; j>=0; j--){
			$("footer.modal__footer").append('<button id="modal-button' + (j+1) + '"class="modal__btn" data-micromodal-close>' + options.buttons[j].label + '</button>');
			if(typeof options.buttons[j].response === "string"){
				$("#modal-button" + (j+1)).attr("response",options.buttons[j].response);
			}
			if(options.buttons[j].ignoreInputs===true){
				$("#modal-button" + (j+1)).addClass("ignore_input_validation");
			}
		}
	} else {
		//Default button
		$("footer.modal__footer").append('<button class="modal__btn" data-micromodal-close>' + I18n.getTrans("i.button_ok") + '</button>');
	}

	MicroModal.show('modal', {
		onShow: function(modal,active){
			if(typeof options.openCallback === "function"){
				options.openCallback();
			}
		},
		onClose: function(modal,response){
			if(typeof options.closeCallback === "function"){
				options.closeCallback(response);
			}
		},
		inputs : options.inputs,
		buttons: options.buttons
	});
}
