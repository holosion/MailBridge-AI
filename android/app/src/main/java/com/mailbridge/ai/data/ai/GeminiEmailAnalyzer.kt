package com.mailbridge.ai.data.ai

import com.mailbridge.ai.domain.AiAnalysisResult
import com.mailbridge.ai.domain.DeadlineConfidence
import com.mailbridge.ai.domain.EmailMessage
import com.mailbridge.ai.domain.EmailPriority
import com.mailbridge.ai.domain.UserPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class GeminiEmailAnalyzer(
    private val backendBaseUrl: String,
    private val httpClient: OkHttpClient = OkHttpClient()
) {
    /**
     * Sends email metadata/body to the secure MailBridge AI backend server
     * (never embedding Gemini API keys inside the Android APK).
     */
    suspend fun analyzeEmail(
        email: EmailMessage,
        preferences: UserPreferences
    ): Result<AiAnalysisResult> = withContext(Dispatchers.IO) {
        runCatching {
            val body = JSONObject().apply {
                put("messageId", email.messageId)
                put("senderName", email.senderName)
                put("senderEmail", email.senderEmail)
                put("subject", email.subject)
                put("bodyText", email.bodyText)
                put("receivedAt", email.receivedAtIso)
                put("userPreferences", JSONObject().apply {
                    put("focusCategories", JSONArray(preferences.focusCategories))
                    put("prioritySenders", JSONArray(preferences.prioritySenders))
                    put("sensitivity", preferences.sensitivity.name.lowercase())
                })
            }

            val req = Request.Builder()
                .url("$backendBaseUrl/api/ai/analyze-email")
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val resp = httpClient.newCall(req).execute()
            val raw = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                error("Backend AI analysis error (${resp.code}): $raw")
            }
            parseStructuredResponse(raw)
        }
    }

    companion object {
        fun parseStructuredResponse(rawJson: String): AiAnalysisResult {
            val root = JSONObject(rawJson)
            val analysis = root.optJSONObject("analysis") ?: root

            val priority = when (analysis.optString("priority").lowercase()) {
                "urgent" -> EmailPriority.URGENT
                "important" -> EmailPriority.IMPORTANT
                "promotions" -> EmailPriority.PROMOTIONS
                else -> EmailPriority.NORMAL
            }

            val confidence = when (analysis.optString("deadline_confidence").lowercase()) {
                "explicit" -> DeadlineConfidence.EXPLICIT
                "ambiguous" -> DeadlineConfidence.AMBIGUOUS
                else -> DeadlineConfidence.NONE
            }

            val rawDeadline = if (analysis.isNull("deadline")) null else analysis.optString("deadline")
            val cleanDeadline = rawDeadline?.takeIf { it.isNotBlank() && it.lowercase() != "null" }

            return AiAnalysisResult(
                priority = priority,
                summary = analysis.optString("summary", "Email analyzed."),
                reason = analysis.optString("reason", "Classified from email metadata."),
                actionRequired = analysis.optString("action_required", "No action required."),
                deadline = cleanDeadline,
                deadlineConfidence = confidence,
                suggestedAction = analysis.optString("suggested_action", "Open the email to review.")
            )
        }
    }
}
