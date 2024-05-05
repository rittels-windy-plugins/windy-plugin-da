const globalCss = `<style id='stylesheet-for-windy-plugin-da'>.onwindy-plugin-da #open-in-app{display:none}.onwindy-plugin-da.onwindy-plugin-da-info #search{display:none}.onwindy-plugin-da.onwindy-plugin-da-info #plugin-developer-mode{left:400px}#device-mobile .onwindy-plugin-da.onwindy-plugin-da-info #plugin-developer-mode,#device-tablet .onwindy-plugin-da.onwindy-plugin-da-info #plugin-developer-mode{display:none}#device-mobile .onwindy-plugin-da.onwindy-plugin-da-info #logo-wrapper,#device-tablet .onwindy-plugin-da.onwindy-plugin-da-info #logo-wrapper{display:none}#device-mobile .onwindy-plugin-da.onwindy-plugin-da-info .animated-windy-logo,#device-tablet .onwindy-plugin-da.onwindy-plugin-da-info .animated-windy-logo{animation:enter-and-stay 1.5s ease-in-out;display:block;opacity:1}#windy-plugin-da-info{display:none}.onwindy-plugin-da.onwindy-plugin-da-info #windy-plugin-da-info{display:block}#device-mobile .ondetail #windy-plugin-da-info,#device-mobile .onrplanner #windy-plugin-da-info,#device-mobile .onmenu #windy-plugin-da-info,#device-mobile .onstation #windy-plugin-da-info,#device-mobile .onairport #windy-plugin-da-info,#device-mobile .onwebcams-detail #windy-plugin-da-info,#device-mobile .onradiosonde #windy-plugin-da-info,#device-tablet .ondetail #windy-plugin-da-info,#device-tablet .onrplanner #windy-plugin-da-info,#device-tablet .onmenu #windy-plugin-da-info,#device-tablet .onstation #windy-plugin-da-info,#device-tablet .onairport #windy-plugin-da-info,#device-tablet .onwebcams-detail #windy-plugin-da-info,#device-tablet .onradiosonde #windy-plugin-da-info{max-height:0px !important;padding-top:0px !important;padding-bottom:0px !important}#device-mobile .ondetail #windy-plugin-da-info .corner-handle,#device-mobile .onrplanner #windy-plugin-da-info .corner-handle,#device-mobile .onmenu #windy-plugin-da-info .corner-handle,#device-mobile .onstation #windy-plugin-da-info .corner-handle,#device-mobile .onairport #windy-plugin-da-info .corner-handle,#device-mobile .onwebcams-detail #windy-plugin-da-info .corner-handle,#device-mobile .onradiosonde #windy-plugin-da-info .corner-handle,#device-tablet .ondetail #windy-plugin-da-info .corner-handle,#device-tablet .onrplanner #windy-plugin-da-info .corner-handle,#device-tablet .onmenu #windy-plugin-da-info .corner-handle,#device-tablet .onstation #windy-plugin-da-info .corner-handle,#device-tablet .onairport #windy-plugin-da-info .corner-handle,#device-tablet .onwebcams-detail #windy-plugin-da-info .corner-handle,#device-tablet .onradiosonde #windy-plugin-da-info .corner-handle,#device-mobile .ondetail #windy-plugin-da-info .corner-handle-top,#device-mobile .onrplanner #windy-plugin-da-info .corner-handle-top,#device-mobile .onmenu #windy-plugin-da-info .corner-handle-top,#device-mobile .onstation #windy-plugin-da-info .corner-handle-top,#device-mobile .onairport #windy-plugin-da-info .corner-handle-top,#device-mobile .onwebcams-detail #windy-plugin-da-info .corner-handle-top,#device-mobile .onradiosonde #windy-plugin-da-info .corner-handle-top,#device-tablet .ondetail #windy-plugin-da-info .corner-handle-top,#device-tablet .onrplanner #windy-plugin-da-info .corner-handle-top,#device-tablet .onmenu #windy-plugin-da-info .corner-handle-top,#device-tablet .onstation #windy-plugin-da-info .corner-handle-top,#device-tablet .onairport #windy-plugin-da-info .corner-handle-top,#device-tablet .onwebcams-detail #windy-plugin-da-info .corner-handle-top,#device-tablet .onradiosonde #windy-plugin-da-info .corner-handle-top,#device-mobile .ondetail #windy-plugin-da-info .closing-x,#device-mobile .onrplanner #windy-plugin-da-info .closing-x,#device-mobile .onmenu #windy-plugin-da-info .closing-x,#device-mobile .onstation #windy-plugin-da-info .closing-x,#device-mobile .onairport #windy-plugin-da-info .closing-x,#device-mobile .onwebcams-detail #windy-plugin-da-info .closing-x,#device-mobile .onradiosonde #windy-plugin-da-info .closing-x,#device-tablet .ondetail #windy-plugin-da-info .closing-x,#device-tablet .onrplanner #windy-plugin-da-info .closing-x,#device-tablet .onmenu #windy-plugin-da-info .closing-x,#device-tablet .onstation #windy-plugin-da-info .closing-x,#device-tablet .onairport #windy-plugin-da-info .closing-x,#device-tablet .onwebcams-detail #windy-plugin-da-info .closing-x,#device-tablet .onradiosonde #windy-plugin-da-info .closing-x{display:none !important}#device-mobile #windy-plugin-da-info,#device-tablet #windy-plugin-da-info{right:8px;width:auto;background-color:#404040ff}#device-mobile #windy-plugin-da-info .closing-x,#device-tablet #windy-plugin-da-info .closing-x{right:0px;top:0px;margin:5px;font-size:20px}</style>`;
let globalCssNode;
function insertGlobalCss(){
    if(!document.querySelector("#stylesheet-for-windy-plugin-da")){
        document.head.insertAdjacentHTML('beforeend', globalCss);
        globalCssNode = document.querySelector("#stylesheet-for-windy-plugin-da");
    }
}
function removeGlobalCss(){
    if(globalCssNode){
        globalCssNode.remove();
    }
}
export { globalCssNode, insertGlobalCss, removeGlobalCss };
