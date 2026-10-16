//var playaudio = Cookies.get('audio') === undefined ? false: !!Cookies.get('audio');
//var playvol = Cookies.get('volume') === undefined ? 50 : Cookies.get('volume') ;
var playaudio = false, playvol = 50;
var currentmusic = null, musicSettingsCallback;

// A saved setting, or the fallback when it was never saved. Kept here so music.js works without the site's settings.js.
function audioSettingOr(value, fallback) {
    return value !== undefined && value !== null ? value : fallback;
}

/*
Start an Audio element playing. play() reports failure by rejecting a promise, which
try/catch cannot see, so failures used to surface as "Uncaught (in promise)" errors.
The usual failure is the browser's autoplay rule: no sound until the player has clicked
or pressed a key. Then try once more on the first click or key press, if still wanted.
*/
function startAudio(audio, retry = true) {
    const result = audio.play();
    if (result) {
        result.catch(error => {
            if (retry && error.name === 'NotAllowedError') {
                const resume = () => {
                    document.removeEventListener('keydown', resume, true);
                    document.removeEventListener('pointerdown', resume, true);
                    if (audio === currentmusic && playaudio && audio.paused) {
                        startAudio(audio, false);
                    }
                };
                document.addEventListener('keydown', resume, true);
                document.addEventListener('pointerdown', resume, true);
            }
        });
    }
}

function registerAudioSettings(callback){
    musicSettingsCallback = callback;
}

function applyAudioSettings(){
    playvol = audioSettingOr(musicSettingsCallback('volume'), 50);
    playaudio = audioSettingOr(musicSettingsCallback('audio'), false);
    setVolume();
}

function setMusic(music, loop = true, restart = false){
    if (currentmusic && !currentmusic.paused) {
        currentmusic.pause();
    }
    if (typeof music === 'string'){
        music = new Audio(music);
    }
    currentmusic = music;
    if (currentmusic) {
        currentmusic.loop = loop;
        currentmusic.volume = playvol /100;
        if (currentmusic.paused && playaudio) {
            if (restart) {
                currentmusic.currentTime = 0;
            }
            startAudio(currentmusic);
        }
    }
    return music;
}

function playMusic() {
    if (currentmusic) {
        startAudio(currentmusic);
    }
}

function pauseMusic() {
    if (currentmusic) {
        currentmusic.pause();
    }
}

function restartMusic() {
    if (currentmusic) {
        currentmusic.currentTime = 0;
    }
}

function setAudioState(state){
    playaudio = state;
    if (musicSettingsCallback) {
        musicSettingsCallback('audio', playaudio);
    }
}

function getAudioState(){
    return playaudio;
}

function setVolume(){
    if (currentmusic) {
        const i = playaudio ? 1 : 0;
        if (playaudio) {
            if (currentmusic.paused) {
                currentmusic.loop = true;
                currentmusic.currentTime = 0;
                startAudio(currentmusic);
            }
            currentmusic.volume = playvol/100;
        }
        else {
            if (!currentmusic.paused) {			
                currentmusic.pause();
            }
        }
    }
}

function updateVolume(change){
	playvol = playvol+change > 100 ? 100 : playvol+change < 0 ? 0 : playvol+change; 
    if (musicSettingsCallback) {
        musicSettingsCallback('volume', playvol);
    }
	setVolume();
}

function loadSound(href){
    return new Audio(href);
}

function playSound(clip){
    // clip is null when the game loaded no sound for this event.
    if (playaudio && clip) {
        const audio = (typeof clip === 'string') ? loadSound(clip) : clip;
        audio.volume = playvol / 100;
        audio.loop = false;
        // A sound effect is only worth playing now, so don't retry it later.
        startAudio(audio, false);
    }
}
