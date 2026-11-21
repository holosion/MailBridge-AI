package com.mailbridge.ai

import android.app.Application
import com.google.firebase.FirebaseApp

class MailBridgeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}
