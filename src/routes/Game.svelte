<script>
	import { onMount } from "svelte";
	import { scale } from "svelte/transition";
    import { Interval, Scale } from "tonal";
    import * as Tone from "tone";
    let pointHistory = $state([]);
    let correctNotes = $state();
    let elementValues = $state({});
    const allNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "C", "C#"];
    let noteInputs = [];
    let key = "C Major";
    let previousGames = $state([0]);
    let totalPoints = $derived(pointHistory.reduce((accumulator, currentValue) => accumulator + currentValue, 0));
    // let buff = $state(0);
    const buff = 1; // make it hard :}
    let synth;
    let maxSeq = $state(5);
    let audioContext;
    let soundBuffer;
    const compliments = [
        "Perfect", "Flawless", "Amazing", "Impressive", "Superb", "Incredible", "Insane",
        "Brilliant", "Outstanding", "Exceptional", "Phenomenal", "Magnificent", "Stellar", 
        "Extraordinary", "Spectacular", "Masterful", "Excellent", "Remarkable", "Fantastic",
        "Virtuoso", "Unbelievable", "Legendary", "Sublime", "Divine", "Breathtaking", 
        "Astonishing", "Marvelous", "Splendid", "Dazzling", "Epic"
    ];
    let compliment = $state(compliments[0]);
    elementValues.timeLeft = -1;
    
    elementValues.hideMenu = !true;
    
    elementValues.timerEnding = false;

    let updateNoteInputs = () => {
        let l = [];
        for (let e of elementValues.noteInputs.children) {
            if (e instanceof HTMLInputElement) {
                l.push(e.value);
            }
        }
        noteInputs = l;
    }
    function filterNotes(e) {
        let allowedInputs = allNotes;
        if (!allowedInputs.includes(e.target.value[0].toUpperCase())) {
            e.target.value = ""
        }
        
        if (e.target.value[1] && !["#", "b"].includes(e.target.value[1])) {
            e.target.value = e.target.value[0];
        }
    }

    function keypressFilter(e) {
        e.preventDefault();
        e.target.value += String.fromCharCode(e.keyCode);
        filterNotes(e);
        updateNoteInputs();
        elementValues.submitButton = noteInputs.every(Boolean);
        if (e.key == "Enter" && elementValues.submitButton) {
            submitCheck();
        }
    }
    function randomNote(accidentalChance=0.2) {
        let note = Scale.get(key).notes[Math.floor(Math.random()*7)];
        // console.log(note, Scale.get(key));
        if (Math.random() < 0.2) {
            note += "#";
        }
        let octave = 4
        if (Math.random() < 0.4) {
            octave++;
        }
        if (Math.random() < 0.1) {
            octave++;
        }
        if (note == "B#") note = "C"; // Wierd B# issue
        note += octave.toString();
        return note;
    }
    function randomNotes(len = (2 + Math.round(Math.random()*(maxSeq-2)))) {
        let notes = [];
        for (let i = 0; i < len; i++) {
            notes.push(randomNote());
        }
        // console.log(notes);
        return notes;
    }
    function submitCheck(e = undefined) {
        let earnedPoints = 0;
        let avgDiff = 0;
        // increase points by accuracy exponentially
        for (let i = 0; i < noteInputs.length; i++) {
            // console.log(correctNotes.slice(0, -1));
            avgDiff += Math.min(
                Math.abs(Interval.semitones(Interval.simplify(Interval.distance(noteInputs[i].toLowerCase()+"3", correctNotes[i].slice(0, -1).toLowerCase()+"4")))),
                Math.abs(Interval.semitones(Interval.simplify(Interval.distance(noteInputs[i].toLowerCase()+"4", correctNotes[i].slice(0, -1).toLowerCase()+"4")))),
                Math.abs(Interval.semitones(Interval.simplify(Interval.distance(noteInputs[i].toLowerCase()+"5", correctNotes[i].slice(0, -1).toLowerCase()+"4")))),
            )/noteInputs.length;
        }
        // 0=< avgDiff =< 5 always true
        let score = Math.pow(2, buff + (((maxSeq-buff)/maxSeq) * (noteInputs.length * Math.abs(avgDiff - 5) / 5))) * 10
        // console.log(score);
        score = Math.floor(score);
        
        if (avgDiff == 0) {
            bonusTrigger(20*noteInputs.length, "100% accurate");
            score += 20*noteInputs.length;
        }
        pointHistory.push(score);
        // console.log(pointHistory);
        elementValues.lastCorrectNotes = correctNotes;
        elementValues.lastUserInput = noteInputs;
        // Include sound effects
        roundReset();

    }

    function roundReset() {
        for (let e of elementValues.noteInputs.children) {
            if (e instanceof HTMLInputElement) {
                e.value = "";
            }
        }
        // svelte tick
        setTimeout(() => {
            elementValues.alreadyPlayed = false;
            correctNotes = randomNotes();
            playNotes(correctNotes)
        }, 200);
        setTimeout(() => {

            let brokenRound = true;
            for (let e of elementValues.noteInputs.children) {
                if (e.value != "" && e instanceof HTMLInputElement && e.disabled) {
                    brokenRound = false;
                }
            }
            if (brokenRound) {
                roundReset();
                return;
            }
        },  599);
    }

    function fullGameReset() {
        elementValues.timeLeft = 199;
        pointHistory = [];
        roundReset();
    }
    function skipRound() {
        let brokenRound = true;
        for (let e of elementValues.noteInputs.children) {
            if (e.value != "" && e instanceof HTMLInputElement && e.disabled) {
                brokenRound = false;
            }
        }
        if (brokenRound) {
            roundReset();
            return;
        }
        if (confirm(`Are you sure you want to skip? you will LOSE ${Math.round(Math.max(60, totalPoints*0.05))} Points`)) {
            pointHistory.push(-Math.round(Math.max(60, totalPoints*0.05)));
            roundReset();
        }
    }
    async function playNotes(notes) {
        elementValues.audioElement.play();
        await Tone.start();
        for (let index = 0; index < notes.length; index++) {
            synth.triggerAttackRelease(notes[index], 1/(1*1.5), Tone.now()+(index/(1*1.5)));
        }
        // elementValues.alreadyPlayed = true;
        // alert(notes);
        // return;
    }

    function playSound(volume = 1.0, playbackRate = 1.0) {
    return new Promise((resolve, reject) => {
        // If the audio context is suspended (e.g., due to browser autoplay policy),
        // resume it first
        if (audioContext.state === 'suspended') {
        audioContext.resume();
        }
        
        // If sound is still loading, wait for it to complete
        if (!soundBuffer) {
        loadingPromise
            .then(() => playAndResolve())
            .catch(error => reject(error));
        } else {
        playAndResolve();
        }
        
        function playAndResolve() {
        try {
            // Create a sound source
            const source = audioContext.createBufferSource();
            source.buffer = soundBuffer;
            source.playbackRate.value = playbackRate;
            
            // Create a gain node for volume control
            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume;
            
            // Connect the nodes
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Play the sound
            source.start(0);
            
            // Resolve the promise
            resolve(source);
        } catch (error) {
            reject(error);
        }
        }
    });
}

    function soundEffect() {
        console.log("sfx");
        
        playSound();
    }

    function bonusTrigger(bonus = 50, message=undefined) {
        elementValues.bonusMessage = message;
        elementValues.bonusPoints = bonus;
        elementValues.bonus = true;
        compliment = compliments[Math.floor(Math.random()*compliments.length)];
        setTimeout(() => {
            elementValues.bonus = false;
            elementValues.bonusMessage = undefined;
        }, 2000);
        elementValues.bonusSfx.play();
    }

    onMount(() => {
        setInterval(() => {
            elementValues.timeLeft -= 0.1;
            if (elementValues.timeLeft < 0) {
                if (pointHistory != [] && pointHistory.reduce((accumulator, currentValue) => accumulator + currentValue, 0) > 0) {
                    previousGames.push(pointHistory.reduce((accumulator, currentValue) => accumulator + currentValue, 0));
                    localStorage.setItem('previousGames', JSON.stringify(previousGames.filter(num => num !== 0)));
                }
                pointHistory = [];
            }
            // Lazy Bugfixes
            updateNoteInputs();
            elementValues.submitButton = noteInputs.every(Boolean);


            elementValues.timerEnding = ((0 < elementValues.timeLeft) && (elementValues.timeLeft < 10));

            }, 100);
        /* setInterval(() => {
            compliment = compliments[Math.floor(Math.random()*compliments.length)];
        }, 300); */
        const piano = new Tone.Sampler({
        urls: {
          A0: "A0.mp3",
          C1: "C1.mp3",
          A1: "A1.mp3",
          C2: "C2.mp3",
          A2: "A2.mp3",
          C3: "C3.mp3",
          A3: "A3.mp3",
          C4: "C4.mp3",
          A4: "A4.mp3",
          C5: "C5.mp3",
          A5: "A5.mp3",
          C6: "C6.mp3",
          A6: "A6.mp3",
          C7: "C7.mp3",
          A7: "A7.mp3",
          C8: "C8.mp3",
        },
        // baseUrl: "https://tonejs.github.io/audio/salamander/", // FluidR3 GM SoundFont
        baseUrl: "/NoteSamples/", // FluidR3 GM SoundFont
        onload: () => {
          console.log("Piano SoundFont loaded!");
        }
      }).toDestination();

        // synth = new Tone.Synth().toDestination();
        synth = piano;
        if (localStorage.getItem('previousGames') == null) {
            localStorage.setItem('previousGames', JSON.stringify([0]));
        }
        previousGames = JSON.parse(localStorage.getItem("previousGames"));

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Store the loaded audio buffer
        soundBuffer = null;

        let loadingPromise = fetch("soundEffects/pickupCoin 2.wav")
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(decodedData => {
                soundBuffer = decodedData;
                console.log('Sound effect loaded successfully');
            })
            .catch(error => {
                console.error('Error loading sound effect:', error);
            });
            document.addEventListener("click", soundEffect);
            document.addEventListener("click", () => {
                elementValues.clickAnim = true;
                setTimeout(() => {elementValues.clickAnim = false}, 100)
            });
        document.addEventListener("touchstart", soundEffect);
        document.addEventListener("keydown", soundEffect);
        // document.addEventListener("keyup", soundEffect);
    })
</script>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
{#each [0, 2] as i}
    <div class="background {elementValues.timerEnding ? "timerEnding" : ""}">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"  style="margin-left: {i*15 - 37.5}vw;">
        <path fill="#ADDEC9" transform="translate(100 100)">
            <!-- Initial path -->
            <animate
            attributeName="d"
            dur="80s"
            begin="-{i*20}"
            repeatCount="indefinite"
            values="
                M46.5,-33.1C60.6,-19.4,72.5,0,68.3,14.5C64.1,29,43.8,38.8,25.5,44.3C7.2,49.7,-9,50.9,-21.6,44.9C-34.2,38.8,-43.3,25.4,-46.2,11C-49.1,-3.3,-45.9,-18.6,-37.1,-31.2C-28.4,-43.7,-14.2,-53.5,1,-54.3C16.2,-55.1,32.4,-46.9,46.5,-33.1Z;
                M40.5,-34.6C49.7,-20.7,52.5,-4,50.2,13.7C48,31.4,40.6,50.2,27.3,56.6C14,63,-5.3,56.9,-22.7,48.1C-40.2,39.3,-55.8,27.8,-61.9,11.2C-68,-5.4,-64.5,-27,-52.6,-41.5C-40.7,-56,-20.4,-63.2,-2.4,-61.3C15.6,-59.4,31.2,-48.4,40.5,-34.6Z;
                M60.7,-35.7C75.5,-29.8,82.3,-4.7,72.7,8.2C63,21.1,37,21.9,15,33.3C-6.9,44.6,-24.7,66.5,-32.5,64.1C-40.3,61.6,-38.1,34.9,-37.3,15.2C-36.4,-4.5,-37,-17.3,-31,-21.2C-25.1,-25,-12.5,-20.1,5.2,-24.3C22.9,-28.4,45.9,-41.6,60.7,-35.7Z;
                M21.1,-20.5C25.3,-11.6,25.3,-2.9,25.8,10.2C26.2,23.3,27.2,40.9,18.9,48.5C10.5,56.2,-7.1,53.8,-24.8,47C-42.4,40.2,-60,29,-61.4,16C-62.7,3.1,-47.8,-11.5,-34.8,-22.5C-21.9,-33.4,-10.9,-40.6,-1.2,-39.7C8.5,-38.7,16.9,-29.5,21.1,-20.5Z;
                M58.1,-49.8C67.1,-35.1,60.4,-11.4,54.8,12.2C49.1,35.8,44.5,59.4,29.5,69.8C14.6,80.3,-10.8,77.7,-27.9,66.2C-45.1,54.8,-54,34.6,-52.7,18.3C-51.4,2,-39.9,-10.3,-29.4,-25.3C-18.9,-40.3,-9.5,-58,7.6,-64C24.6,-70,49.2,-64.4,58.1,-49.8Z;
                M33.6,-26.8C49.4,-6.9,72.2,7.4,73.3,22.4C74.4,37.5,53.8,53.2,34.3,57.3C14.7,61.4,-3.7,53.8,-15.5,43.7C-27.2,33.6,-32.2,21,-39.6,4.5C-47,-12,-56.7,-32.5,-50.5,-50.2C-44.3,-67.9,-22.2,-82.8,-6.7,-77.5C8.9,-72.2,17.7,-46.7,33.6,-26.8Z;
                M46.5,-33.1C60.6,-19.4,72.5,0,68.3,14.5C64.1,29,43.8,38.8,25.5,44.3C7.2,49.7,-9,50.9,-21.6,44.9C-34.2,38.8,-43.3,25.4,-46.2,11C-49.1,-3.3,-45.9,-18.6,-37.1,-31.2C-28.4,-43.7,-14.2,-53.5,1,-54.3C16.2,-55.1,32.4,-46.9,46.5,-33.1Z
            "
            keyTimes="0; 0.166; 0.333; 0.5; 0.666; 0.833; 1"
            calcMode="spline"
            keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
            />
        </path>
        </svg>
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#ADDEC9" transform="translate(100 100)">
            <!-- Initial path -->
            <animate
            attributeName="d"
            dur="30s"
            repeatCount="indefinite"
            values="
                M46.5,-33.1C60.6,-19.4,72.5,0,68.3,14.5C64.1,29,43.8,38.8,25.5,44.3C7.2,49.7,-9,50.9,-21.6,44.9C-34.2,38.8,-43.3,25.4,-46.2,11C-49.1,-3.3,-45.9,-18.6,-37.1,-31.2C-28.4,-43.7,-14.2,-53.5,1,-54.3C16.2,-55.1,32.4,-46.9,46.5,-33.1Z;
                M40.5,-34.6C49.7,-20.7,52.5,-4,50.2,13.7C48,31.4,40.6,50.2,27.3,56.6C14,63,-5.3,56.9,-22.7,48.1C-40.2,39.3,-55.8,27.8,-61.9,11.2C-68,-5.4,-64.5,-27,-52.6,-41.5C-40.7,-56,-20.4,-63.2,-2.4,-61.3C15.6,-59.4,31.2,-48.4,40.5,-34.6Z;
                M60.7,-35.7C75.5,-29.8,82.3,-4.7,72.7,8.2C63,21.1,37,21.9,15,33.3C-6.9,44.6,-24.7,66.5,-32.5,64.1C-40.3,61.6,-38.1,34.9,-37.3,15.2C-36.4,-4.5,-37,-17.3,-31,-21.2C-25.1,-25,-12.5,-20.1,5.2,-24.3C22.9,-28.4,45.9,-41.6,60.7,-35.7Z;
                M21.1,-20.5C25.3,-11.6,25.3,-2.9,25.8,10.2C26.2,23.3,27.2,40.9,18.9,48.5C10.5,56.2,-7.1,53.8,-24.8,47C-42.4,40.2,-60,29,-61.4,16C-62.7,3.1,-47.8,-11.5,-34.8,-22.5C-21.9,-33.4,-10.9,-40.6,-1.2,-39.7C8.5,-38.7,16.9,-29.5,21.1,-20.5Z;
                M58.1,-49.8C67.1,-35.1,60.4,-11.4,54.8,12.2C49.1,35.8,44.5,59.4,29.5,69.8C14.6,80.3,-10.8,77.7,-27.9,66.2C-45.1,54.8,-54,34.6,-52.7,18.3C-51.4,2,-39.9,-10.3,-29.4,-25.3C-18.9,-40.3,-9.5,-58,7.6,-64C24.6,-70,49.2,-64.4,58.1,-49.8Z;
                M33.6,-26.8C49.4,-6.9,72.2,7.4,73.3,22.4C74.4,37.5,53.8,53.2,34.3,57.3C14.7,61.4,-3.7,53.8,-15.5,43.7C-27.2,33.6,-32.2,21,-39.6,4.5C-47,-12,-56.7,-32.5,-50.5,-50.2C-44.3,-67.9,-22.2,-82.8,-6.7,-77.5C8.9,-72.2,17.7,-46.7,33.6,-26.8Z;
                M46.5,-33.1C60.6,-19.4,72.5,0,68.3,14.5C64.1,29,43.8,38.8,25.5,44.3C7.2,49.7,-9,50.9,-21.6,44.9C-34.2,38.8,-43.3,25.4,-46.2,11C-49.1,-3.3,-45.9,-18.6,-37.1,-31.2C-28.4,-43.7,-14.2,-53.5,1,-54.3C16.2,-55.1,32.4,-46.9,46.5,-33.1Z
            "
            keyTimes="0; 0.166; 0.333; 0.5; 0.666; 0.833; 1"
            calcMode="spline"
            keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
            />
        </path>
        </svg>
    </div>
{/each}

{#if elementValues.bonus}
    <div class="bonus overlay bottomMessage">
        --------
        <br>
        {compliment}
        <br>
        +{elementValues.bonusPoints} Points
        <br>
        --------
    </div>
{/if}

{#if (elementValues.bonusMessage && elementValues.bonus)}
    <div class="overlay bonus topMessage">
        -==- {elementValues.bonusMessage} -==-
    </div>
{/if}

<div class="cursorTracker"></div>
<div class="overlay vignette  {elementValues.timerEnding ? "timerEnding" : ""}"></div>
{#if elementValues.timeLeft < 0 && !elementValues.hideMenu}
    <div class="menuScreen">
        <h1>Melodre</h1>
        
        <h4>Last Game: {previousGames.at(-1)} Points</h4>
        <h4>High Score: {Math.max(...previousGames)} Points</h4>
        <h4>Total Score: {previousGames.reduce((accumulator, currentValue) => accumulator + currentValue, 0)}</h4>
        <button onclick={fullGameReset}>New Game</button>
    </div>
{/if}
<div class="mainContainer">
    <span class="timer  {elementValues.timerEnding ? "timerEnding" : ""}">
        <!-- <span class="material-icons">&#xe425;</span>  -->
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,20a9,9,0,1,1,9-9A9,9,0,0,1,12,21Z" />
            <rect width="2.5" height="6" x="11" y="6" fill="currentColor" rx="1">
                <animateTransform attributeName="transform" dur="36s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12" />
            </rect>
            <rect width="2.5" height="8" x="11" y="11" fill="currentColor" rx="1">
                <animateTransform attributeName="transform" dur="6s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12" />
            </rect>
        </svg>
        {elementValues.timeLeft.toFixed(1)}s
    </span>
    <!-- <input type="number" bind:value={buff}> -->
    {#if elementValues.lastCorrectNotes}

        <div class="noteInputs noteCorrections  {elementValues.timerEnding ? "timerEnding" : ""}">
            <span>Correct Notes: </span>
            {#each elementValues.lastCorrectNotes as note, index}
                <input type="text" value="{note}" disabled>
            {/each}
        </div>
        <div class="noteInputs noteCorrections  {elementValues.timerEnding ? "timerEnding" : ""}">
            <span>Your Guess:    </span>
            {#each elementValues.lastUserInput as note, index}
                <input type="text" value="{note}" disabled>
            {/each}
        </div>

    {/if}
    <div class="noteInputs" bind:this={elementValues.noteInputs}>

        {#each correctNotes as note, index}
            {#if index == 0}
                <input type="text" value="{note.slice(0, -1)}" disabled>
            {:else}
                <input type="text" onchange={filterNotes} maxlength="2" onkeypress={keypressFilter} >
            {/if}
        {/each}
        <button class="submitButton" disabled={!elementValues.submitButton} onclick={submitCheck}><span class="material-icons">&#xf091;</span></button>

    </div>
    <button onclick={() => {playNotes(correctNotes)}}>
        <span class="material-icons">
            &#xe037;
        </span>
        {elementValues.alreadyPlayed ? "Re\u2014": ""}Play
    </button>
    <button onclick={skipRound}>
        <span class="material-icons">
            &#xe044;
        </span>
        {elementValues.alreadyPlayed ? "Re\u2014": ""}Skip
    </button>
    <div class="pointsList">
        {pointHistory.reduce((accumulator, currentValue) => accumulator + currentValue, 0)} points
        {#each pointHistory.slice(-3) as pt, index}
            <span class="p{index+1}">+{pointHistory.at(-(index+1))} Points{pointHistory.at(-(index+1)) >= 500 ? "!" : ""}</span>
        {/each}
        <!-- <span class="p1">+{pointHistory.at(-1)} Points{pointHistory.at(-1) >= 500 ? "!" : ""}</span>
        <span class="p2">+{pointHistory.at(-2)} Points{pointHistory.at(-2) >= 500 ? "!" : ""}</span>
        <span class="p3">+{pointHistory.at(-3)} Points{pointHistory.at(-3) >= 500 ? "!" : ""}</span> -->
    </div>
</div>
<audio src="silence.mp3" bind:this={elementValues.audioElement}></audio>
<audio src="soundEffects/powerUp 2.wav" bind:this={elementValues.bonusSfx}></audio>

<style>

    /* @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap'); */
    
    /* @import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap'); */

    @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

    :root {
        --color-primary: #1F5657;
        --color-secondary: #3AB9AD;
        --color-accent: #ADDEC9;
        --color-light: #F9FBFA;
        --color-brown: #CE8C5E;
    }
    @media screen and (min-width: 100vh) {
        /* The width is greater than the height */
        :root {
            --unit: 1vw;
        }
    }
    :global(html) {

        background-color: var(--color-primary);
    }
    :global(html, body), .mainContainer {
        color: var(--color-light);
        font-family: Roboto;
        font-family: "Pixelify Sans", sans-serif;
        font-optical-sizing: auto;
        height: 100%;
        position:relative;
    }

    :global(*) {
        font-family: "VT323", monospace;
        font-optical-sizing: auto;
        text-shadow: 0px 0px 10px color-mix(in srgb, var(--color-accent) 80%,   black 10%);
    }
    :global(button) {
        appearance: none;
        -webkit-appearance: none;
    }

    .bonus {
        position: fixed;
        font-size: 3rem;
        font-weight: bolder;
        /* color: var(--color-brown); */
        text-align: center;
        text-transform: uppercase;
        display: flex;
        flex-direction: column;
        align-items: center;
        animation: bonusIn 0.3s, flicker 0.1s steps(2) infinite, fadeOut 0.5s 1.5s forwards;
    }
    .bottomMessage {
        justify-content: end;
        margin-bottom: 0.5em;
    }
    .topMessage {
        margin-top: 1em;
        /* margin-bottom: 1em !important; */
        justify-content: start;
    }
    
    @keyframes expand {
        from {
            width: 1.5em;
        }
        to {
            width: 2em;
        }
    }

    @keyframes redFlicker {
        50% {
            color: red;
            background-color: red;
            opacity: 40%;
        }
    }
    @keyframes bonusIn {
        from {
            transform: scale(0, 0);
        }
        to {
            transform: scale(1, 1);
        }
    }

    @keyframes fadeOut {
        from {
            opacity: 100%;
        }
        to {
            opacity: 0%;
        }
    }
    @keyframes flicker {
        from {
            color: var(--color-light);
            text-shadow: 0px 3px 10px var(--color-accent);
        }
        to {
            color: var(--color-primary);
            text-shadow: 0px 0px 0px;
        }
    }
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 3;
        overflow: hidden; /* Prevent any overflow issues */
        pointer-events: none; /* Allow clicks to pass through */
        
    }
    .vignette {
        box-shadow: inset 0 0 100px 80px black;
        border: none;
        width: 110vw;
        height: 110vh;
        margin-left: -5vw;
        margin-top: -5vh;
        overflow: hidden; /* Prevent any overflow issues */
        opacity: 60%;
        /* opacity: 0%; */
    }
    .background {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        overflow: hidden; /* Prevent any overflow issues */
        pointer-events: none; /* Allow clicks to pass through */
        opacity: 10%;

        svg {
            display: block;
            margin-left: -37.5vw;
            margin-top: -50vh;
            width: 150vw;
            filter: drop-shadow(3px 5px 40px var(--color-brown));
            /* height: 100%; */
            /* object-fit: cover; */
        }
    }

    .menuScreen {
        
        position: fixed;
        display: flex;
        flex-direction: column;
        align-items: center;
        /* display: none; */
        justify-content: center;
        width: 100%;
        height: 100%;
        background-color: var(--color-primary);
        z-index: 2;
        font-size: 2rem;

        h1, h4{
            margin: 0px;
            font-weight: bolder;
        }
        gap: 1rem;
        left: 0;
        top: 0;

        button {
            color: var(--color-light);
            font-size: xx-large;
            text-decoration: underline;
            background: transparent;
            border: none;
            font-weight: bolder;
        }
    }
    .mainContainer {
        display: flex;
        flex-direction: column;
        /* justify-content: space-evenly; */
        align-items: center;
        height: 60%;
        /* width: 80%; */
        button {
            font-size: larger;
            display: flex;
            padding: 0.2em;
            padding-top: 0.05em;
            padding-bottom: 0.05em;
            letter-spacing: 0.1em;
            margin: 0.25em;

            box-shadow: 0 0 30px 2px color-mix(in srgb, black 30%, transparent 70%);

            border-radius: 6px;
            border-color: color-mix(in srgb, black 50%, var(--color-primary) 50%);
            color: var(--color-primary);
            background-color: var(--color-accent);
            font-weight: normal;
        }

        .timer {
            display: flex;
            align-items: center;
            font-size: x-large;
            font-weight: bold;
            gap: 0.25em;
            margin: 0.75em;
            margin-bottom: calc(25vh + 0.75em);
        }
        .noteInputs {
            margin-bottom: 1em;
            display: flex;
            gap: 0.4em;
            justify-content: space-between;
            border-radius: 0.1em;
            /* width: 100%; */
            input {
                box-shadow: 0 0 30px 2px color-mix(in srgb, var(--color-brown) 60%, transparent 40%);
                width: 1em;
                font-size: xx-large;
                text-align: center;
                padding: 0px;
                width: 1.5em;
                caret-color: color-mix(in srgb, var(--color-light) 50%, var(--color-primary) 50%);
                background-color: var(--color-secondary);
                color: var(--color-light);
                font-weight: bolder ;
                text-transform: capitalize;
                border-radius: 7px;
                border: none;
            }
            input:focus {
                animation: expand .5s;
                width: 2em;
                background-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-primary) 50%);
                box-shadow: 0 0 30px 2px color-mix(in srgb, var(--color-brown) 80%, transparent 20%);
            }
            input:disabled {
                opacity: 50%;
            }
            .submitButton {
                box-shadow: 0 0 30px 2px color-mix(in srgb, var(--color-brown) 30%, transparent 70%);
                margin: 0px;
                text-align: center;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .submitButton:disabled {
                opacity: 0.35;
                box-shadow: 0 0 30px 2px color-mix(in srgb, var(--color-brown) 90%, transparent 10%);
            }
        }


        .noteCorrections {
            gap: 0.2em;
            margin-bottom: 1em;
            justify-content: center;
            input { 

                box-shadow: 0 0 30px 2px color-mix(in srgb, var(--color-brown) 20%, transparent 80%);
                width: 1.8em;
                font-size: x-large;
            }
        }

        .pointsList {
            display: flex;
            flex-direction: column;
            text-align: left;
            font-size: xx-large;
            margin-right: 3em;
            align-self: flex-end;
            font-weight: bold;
            color: color-mix(in srgb, var(--color-white) 50%, var(--color-accent) 50%);
            .p1 {
                color: color-mix(in srgb, var(--color-white) 40%, var(--color-accent) 60%);
                opacity: 80%;
                font-size: 1.4rem;
            }
            .p2 {
                
            color: color-mix(in srgb, var(--color-white) 30%, var(--color-accent) 70%);
                opacity: 60%;
                font-size: 1.25rem;
            }
            .p3 {
            
                color: color-mix(in srgb, var(--color-white) 15%, var(--color-accent) 85%);
                opacity: 40%;
                font-size: 1.1rem;
            }
        }
    }

    input, button {
        border-radius: 0px;
        /* box-shadow: 0px 0px 10px 10px white; */
    }


    .timerEnding {
        /* visibility: hidden !important;
        opacity: 0% !important; */
        animation: redFlicker 1s infinite !important;
    }

    .cursorTracker {
        width: 1.5em;
        height: 1.5em;
        border-radius: 50%;
        background-color: var(--color-accent);
        opacity: 40% !important;
        border-width: 3px;
        border-color: var(--color-light);
        box-shadow: 0px 0px 10px 4px var(--color-light);
        pointer-events: none;
    }
    .clickAnimClass {
        animation: clickAnim 0.1s linear;
    }

    @keyframes clickAnim {
        50% {
            transform: scale(2, 2);
        }
    }
</style>