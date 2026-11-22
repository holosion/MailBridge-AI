package com.mailbridge.ai.ui

import android.accounts.Account
import android.app.Activity
import android.app.Application
import android.content.Intent
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.mailbridge.ai.data.gmail.GmailApiClient
import com.mailbridge.ai.domain.EmailMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

data class AccountUiState(
    val email: String? = null,
    val busy: Boolean = false,
    val gmailConnected: Boolean = false,
    val messages: List<EmailMessage> = emptyList(),
    val error: String? = null,
)

class AccountViewModel(application: Application) : AndroidViewModel(application) {
    private val auth = FirebaseAuth.getInstance()
    private val credentials = CredentialManager.create(application)
    private val gmail = GmailApiClient()
    private val mutableState = MutableStateFlow(AccountUiState(email = auth.currentUser?.email))
    val state = mutableState.asStateFlow()
    private var currentUid = auth.currentUser?.uid
    private var authorizationUid: String? = null
    private val authListener = FirebaseAuth.AuthStateListener {
        if (it.currentUser?.uid != currentUid) {
            currentUid = it.currentUser?.uid
            authorizationUid = null
            mutableState.value = AccountUiState(email = it.currentUser?.email)
        }
    }

    init { auth.addAuthStateListener(authListener) }

    fun signIn(activity: Activity) {
        if (state.value.busy) return
        mutableState.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                // Google Services generates this resource only when a Web OAuth client exists.
                val id = activity.resources.getIdentifier("default_web_client_id", "string", activity.packageName)
                check(id != 0) { "Google sign-in is not configured for this build. Enable Google in Firebase Authentication and download the updated google-services.json, then rebuild the app." }
                val option = GetSignInWithGoogleOption.Builder(activity.getString(id)).build()
                val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                val credential = credentials.getCredential(activity, request).credential
                check(credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    "Google did not return a sign-in credential. Please try again."
                }
                val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
                auth.signInWithCredential(GoogleAuthProvider.getCredential(token, null)).await()
            } catch (_: GetCredentialCancellationException) {
                mutableState.update { it.copy(error = "Sign-in cancelled. You can try again when ready.") }
            } catch (e: CancellationException) { throw e
            } catch (e: Exception) {
                mutableState.update { it.copy(error = "Google sign-in failed. Check your connection and this app's Firebase provider and signing certificate setup. ${e.localizedMessage.orEmpty()}") }
            } finally { mutableState.update { it.copy(busy = false) } }
        }
    }

    fun connectGmail(activity: Activity, launchConsent: (android.app.PendingIntent) -> Unit) {
        val user = auth.currentUser ?: return
        val email = user.email ?: return
        if (state.value.busy) return
        authorizationUid = user.uid
        mutableState.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                val request = AuthorizationRequest.builder()
                    .setAccount(Account(email, "com.google"))
                    .setRequestedScopes(listOf(Scope("https://www.googleapis.com/auth/gmail.readonly")))
                    .build()
                val result = Identity.getAuthorizationClient(activity).authorize(request).await()
                if (auth.currentUser?.uid != user.uid) return@launch
                if (result.hasResolution()) {
                    launchConsent(checkNotNull(result.pendingIntent))
                } else {
                    loadInbox(result, user.uid, email)
                }
            } catch (e: CancellationException) { throw e
            } catch (e: Exception) { failGmail(e) }
        }
    }

    fun consentResult(activity: Activity, resultCode: Int, data: Intent?) {
        val user = auth.currentUser
        val expectedUid = authorizationUid
        if (user == null || user.uid != expectedUid || user.email == null) {
            mutableState.update { it.copy(busy = false) }
            return
        }
        if (resultCode != Activity.RESULT_OK || data == null) {
            mutableState.update { it.copy(busy = false, error = "Gmail permission was not granted. Your Google sign-in is still active.") }
            return
        }
        viewModelScope.launch {
            try {
                val result = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data)
                loadInbox(result, user.uid, user.email!!)
            } catch (e: CancellationException) { throw e
            } catch (e: Exception) { failGmail(e) }
        }
    }

    private suspend fun loadInbox(result: AuthorizationResult, uid: String, email: String) {
        // Tokens and email contents stay in memory. Reauthorize on refresh rather than persist tokens.
        val token = checkNotNull(result.accessToken) { "No Gmail access token was returned. Please reconnect Gmail." }
        val mailbox = gmail.fetchEmailAddress(token).getOrThrow()
        check(mailbox.equals(email, ignoreCase = true)) { "Choose the same Google account you used to sign in." }
        val messages = gmail.fetchRecentMessages(token, 20).getOrThrow()
        if (auth.currentUser?.uid == uid) {
            mutableState.update { it.copy(busy = false, gmailConnected = true, messages = messages, error = null) }
        }
    }

    private fun failGmail(error: Exception) {
        val detail = if (error is ApiException) "Google error ${error.statusCode}." else error.localizedMessage.orEmpty()
        mutableState.update { it.copy(busy = false, gmailConnected = false, messages = emptyList(), error = "Could not connect Gmail. Check that Gmail API is enabled and this account is allowed in the OAuth consent setup. $detail") }
    }

    fun signOut() {
        if (state.value.busy) return
        auth.signOut()
        authorizationUid = null
        mutableState.value = AccountUiState(busy = true)
        viewModelScope.launch {
            try { credentials.clearCredentialState(ClearCredentialStateRequest())
            } catch (e: CancellationException) { throw e
            } catch (_: Exception) { /* Firebase session and locally displayed mail are already cleared. */
            } finally { mutableState.update { it.copy(busy = false) } }
        }
    }

    override fun onCleared() {
        auth.removeAuthStateListener(authListener)
        super.onCleared()
    }
}
