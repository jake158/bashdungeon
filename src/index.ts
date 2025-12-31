import '@xterm/xterm/css/xterm.css';
import './layout/style.css';
import './assets/fonts/hack.css';
import { Game } from './game';

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Hack font to load before initializing terminal
    try {
        await document.fonts.load('10px Hack');
    } catch (error) {
        console.warn('Font loading failed, continuing anyway:', error);
    }

    const game = new Game(document.getElementById('terminal'));
    game.start();
});
