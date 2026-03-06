import { createContext, useState } from 'react'

const AudioContext = createContext({
    sound: true,
    music: true,
    toggleSound: () => {},
    toggleMusic: () => {}
});

const AudioProvider = (props) => {
    const [sound, setSound] = useState(true);
    const [music, setMusic] = useState(true);

    // Custom toggle functions
    const toggleSound = () => setSound(prev => !prev);
    const toggleMusic = () => setMusic(prev => !prev);
    
    return (
        <AudioContext.Provider value={{ sound, music, toggleSound, toggleMusic }}>
            {props.children}
        </AudioContext.Provider>
    );
}

export { AudioContext, AudioProvider }