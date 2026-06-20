// firebase.js - Firebase Configuration & Initialization

// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import { 
    getFirestore,
    enableMultiTabIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


// Firebase Config
const firebaseConfig = {

    apiKey: "AIzaSyAjbj519mJnX18lcMavPTgkAC-OQ4L5dsY",

    authDomain: "flip-45e37.firebaseapp.com",

    projectId: "flip-45e37",

    storageBucket: "flip-45e37.firebasestorage.app",

    messagingSenderId: "774430389314",

    appId: "1:774430389314:web:114bd49e5794b3dcb329db",

    measurementId: "G-JT42H3S38R"

};


// Initialize Firebase

const app = initializeApp(firebaseConfig);


// Firestore

const db = getFirestore(app);


// Offline persistence
// giúp reconnect khi mất mạng / refresh

enableMultiTabIndexedDbPersistence(db)
.then(() => {

    console.log("Firebase offline persistence enabled");

})
.catch((err)=>{

    if(err.code === "failed-precondition"){

        console.warn(
            "Persistence failed: Multiple tabs open"
        );

    }

    else if(err.code === "unimplemented"){

        console.warn(
            "Browser does not support persistence"
        );

    }

});


window.db = db;

export { db };