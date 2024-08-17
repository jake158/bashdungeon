import '@xterm/xterm/css/xterm.css';
import './layout/style.css';
import { Game } from './game.js';


document.addEventListener('DOMContentLoaded', () => {
    const game = new Game(document.getElementById('terminal'));
    game.start();
});
