import '@xterm/xterm/css/xterm.css';

import './assets/fonts/hack.css';
import { Game } from './game';
import './layout/style.css';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await document.fonts.load('10px Hack');
    } catch (error) {
        console.warn('Font loading failed, continuing anyway:', error);
    }

    const game = new Game(document.getElementById('terminal'));
    game.start();
});
