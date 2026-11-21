package com.mailbridge.ai.domain

enum class EmailPriority {
    URGENT, IMPORTANT, NORMAL, PROMOTIONS
}

enum class DeadlineConfidence {
    EXPLICIT, AMBIGUOUS, NONE
}

enum class SensitivityMode {
    BALANCED, STRICT, HIGH_RECALL
}

data class EmailMessage(
    val messageId: String,
    val threadId: String,
    val senderName: String,
    val senderEmail: String,
    val subject: String,
    val snippet: String,
    val bodyText: String,
    val receivedAtIso: String,
    val isUnread: Boolean,
    val providerId: String = "gmail"
)

data class AiAnalysisResult(
    val priority: EmailPriority,
    val summary: String,
    val reason: String,
    val actionRequired: String,
    val deadline: String?,
    val deadlineConfidence: DeadlineConfidence,
    val suggestedAction: String
)

data class UserPreferences(
    val focusCategories: List<String> = listOf("university", "jobs", "work", "security"),
    val prioritySenders: List<String> = emptyList(),
    val sensitivity: SensitivityMode = SensitivityMode.BALANCED,
    val quietHoursEnabled: Boolean = true,
    val quietHoursStart: String = "22:00",
    val quietHoursEnd: String = "07:00",
    val pushAlertsEnabled: Boolean = true,
    val whatsappAlertsEnabled: Boolean = false
)

/**
 * Provider-agnostic interface so Outlook/IMAP and a shared iOS KMP layer
 * can plug into MailBridge AI without rewriting UI or Gemini analysis.
 */
interface EmailProviderClient {
    val providerId: String
    suspend fun fetchRecentMessages(accessToken: String, maxResults: Int = 20): Result<List<EmailMessage>>
    suspend fun registerWatch(accessToken: String, topicName: String): Result<String>
}
