import $ from 'jquery/dist/jquery.slim';
import main from './main';

window.$ = window.jQuery = $;
require('bootstrap/dist/js/bootstrap');

$(main.init);
