import '../../css/birds.scss';

export function start(imagesPath){
  this.stop();
  let htmlCode = '<div id="escapp_bird_animation"><div class="bird-container bird-container--one"><div class="bird bird--one"></div></div><div class="bird-container bird-container--two"><div class="bird bird--two"></div></div><div class="bird-container bird-container--three"><div class="bird bird--three"></div></div><div class="bird-container bird-container--four"><div class="bird bird--four"></div></div></div>';
  $("body").prepend(htmlCode);
  $("#escapp_bird_animation .bird").css("background-image","url(" + imagesPath + "/bird-cells.svg)");
  $("#escapp_bird_animation").show();
}

export function stop(){
  $("#escapp_bird_animation").remove();
}