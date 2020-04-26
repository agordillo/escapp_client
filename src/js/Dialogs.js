import '../css/dialogs.scss';
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
  let modalHTMLcode = '<div class="escapp-modal micromodal-slide" id="escapp-modal" aria-hidden="true"><div class="escapp-modal__overlay" tabIndex="-1"><div class="escapp-modal__container" role="dialog" aria-modal="true"><header class="escapp-modal__header"><h2 class="escapp-modal__title" id="escapp-modal-title"></h2></header><main class="escapp-modal__content" id="escapp-modal-content"><p class="content"></p></main><footer class="escapp-modal__footer"></footer></div></div>';
  $("body").prepend(modalHTMLcode);
  $("#escapp-modal div.escapp-modal__container").prepend('<img class="dialog_corner logo" src="' + imagesPath + 'escapp_logo_dark.png"/>');
  $("#escapp-modal div.escapp-modal__container").prepend('<img class="dialog_corner lock" src="' + imagesPath + 'lock.svg"/>')
  $("#escapp-modal .escapp-modal__content").prepend('<div class="escapp_content_img_wrapper"><img src="' + imagesPath + 'trophy.png"/></div>');
  MicroModal.init({
    disableScroll: true,
    disableFocus: false,
    awaitOpenAnimation: false,
    awaitCloseAnimation: false,
    debugMode: false
  });
};

export function displayDialog(options){
  if($("#escapp-modal").hasClass("is-open")){
    MicroModal.close('escapp-modal', {
      onClose: function(modal,response){
        setTimeout(function(){
          displayDialog(options);
        },50);
      }
    });
    return;
  }

  //Fill data
  $("#escapp-modal-title").html(options.title);
  $("#escapp-modal-content p.content").html(options.text);
  $(".escapp-modal-input").remove();

  //Main img
  if(typeof options.img === "string"){
    $("#escapp-modal .escapp-modal__content div.escapp_content_img_wrapper img").attr("src",options.img);
    $("#escapp-modal .escapp-modal__content div.escapp_content_img_wrapper").show();
  } else {
    $("#escapp-modal .escapp-modal__content div.escapp_content_img_wrapper img").attr("src","");
    $("#escapp-modal .escapp-modal__content div.escapp_content_img_wrapper").hide();
  }

  //Corner img
  let dialogImg;
  if(options.escapp !== false){
    dialogImg = "logo";
  } else {
    let dialogImgs = ["logo","lock"];
    let dialogImgIndex = ["logo","lock"].indexOf(options.icon);
    if(dialogImgIndex !== -1){
      dialogImg = dialogImgs[dialogImgIndex];
    }
  }

  if(typeof dialogImg === "undefined"){
    $("div.escapp-modal__container img.dialog_corner").hide();
  } else {
    $("div.escapp-modal__container img.dialog_corner." + dialogImg).show();
    $("div.escapp-modal__container img.dialog_corner:not(." + dialogImg + ")").hide();
  }

  //Inputs
  if((options.inputs instanceof Array)&&(options.inputs.length > 0)){
    for(var i=0; i<options.inputs.length; i++){
      $("#escapp-modal-content").append('<p><input id="escapp-modal-input' + (i+1) + '" class="escapp-modal-input" type="text" spellcheck="false"/></p>');
      if(typeof options.inputs[i].type === "string"){
        $("#escapp-modal-input" + (i+1)).attr("type",options.inputs[i].type);
      }
      if(typeof options.inputs[i].label === "string"){
        $("#escapp-modal-input" + (i+1)).attr("placeholder",options.inputs[i].label);
      }
      if(typeof options.inputs[i].autocomplete === "string"){
        $("#escapp-modal-input" + (i+1)).attr("autocomplete",options.inputs[i].autocomplete);
      }
    }
  }

  //Buttons
  $("footer.escapp-modal__footer .escapp-modal__btn").remove();
  if(options.buttons instanceof Array){
    for(var j=options.buttons.length-1; j>=0; j--){
      $("footer.escapp-modal__footer").append('<button id="escapp-modal-button' + (j+1) + '"class="escapp-modal__btn" data-micromodal-close>' + options.buttons[j].label + '</button>');
      if(typeof options.buttons[j].response === "string"){
        $("#escapp-modal-button" + (j+1)).attr("response",options.buttons[j].response);
      }
      if(options.buttons[j].ignoreInputs===true){
        $("#escapp-modal-button" + (j+1)).addClass("ignore_input_validation");
      }
    }
  } else {
    //Default button
    $("footer.escapp-modal__footer").append('<button class="escapp-modal__btn" data-micromodal-close>' + I18n.getTrans("i.button_ok") + '</button>');
  }

  //Classes
  if(options.escapp !== false){
    $("#escapp-modal").addClass("escapp_dialog");
    $("#escapp-modal").removeClass("escapp_custom_dialog");
  } else {
    $("#escapp-modal").removeClass("escapp_dialog");
    $("#escapp-modal").addClass("escapp_custom_dialog");
  }

  MicroModal.show('escapp-modal', {
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
};