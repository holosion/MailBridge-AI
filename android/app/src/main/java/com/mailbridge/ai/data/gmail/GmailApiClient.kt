package com.mailbridge.ai.data.gmail

import com.mailbridge.ai.domain.EmailMessage
import com.mailbridge.ai.domain.EmailProviderClient
import java.time.Instant
import java.util.Base64
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class GmailApiClient(
    private val httpClient: OkHttpClient = OkHttpClient(),
    private val baseUrl: String = "https://gmail.googleapis.com/gmail/v1/users/me"
) : EmailProviderClient {
    override val providerId = "gmail"

    private suspend fun <T> ioResult(block: () -> T): Result<T> = withContext(Dispatchers.IO) {
        try { Result.success(block()) }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) { Result.failure(e) }
    }

    private fun getJson(path: String, token: String): JSONObject {
        val request = Request.Builder().url("$baseUrl/$path")
            .header("Authorization", "Bearer $token").build()
        return httpClient.newCall(request).execute().use { response ->
            check(response.isSuccessful) {
                if (response.code == 401) "Gmail permission expired. Please reconnect Gmail."
                else "Gmail API returned HTTP ${response.code}."
            }
            JSONObject(response.body?.string().orEmpty())
        }
    }

    suspend fun fetchEmailAddress(accessToken: String): Result<String> = ioResult {
        getJson("profile", accessToken).getString("emailAddress")
    }

    override suspend fun fetchRecentMessages(accessToken: String, maxResults: Int): Result<List<EmailMessage>> = ioResult {
        val list = getJson("messages?maxResults=${maxResults.coerceIn(1, 50)}&labelIds=INBOX", accessToken)
        val refs = list.optJSONArray("messages") ?: JSONArray()
        buildList {
            for (i in 0 until refs.length()) {
                val id = refs.getJSONObject(i).getString("id")
                require(id.matches(Regex("[a-zA-Z0-9_-]+"))) { "Invalid Gmail message identifier." }
                add(parseMessage(getJson("messages/$id?format=full", accessToken)))
            }
        }
    }

    override suspend fun registerWatch(accessToken: String, topicName: String): Result<String> = ioResult {
        val payload = JSONObject().put("topicName", topicName).put("labelIds", JSONArray().put("INBOX"))
        val request = Request.Builder().url("$baseUrl/watch")
            .header("Authorization", "Bearer $accessToken")
            .post(payload.toString().toRequestBody("application/json".toMediaType())).build()
        httpClient.newCall(request).execute().use { response ->
            check(response.isSuccessful) { "Watch registration failed: HTTP ${response.code}" }
            JSONObject(response.body?.string().orEmpty()).getString("historyId")
        }
    }

    companion object {
        fun parseMessage(message: JSONObject): EmailMessage {
            val payload = message.optJSONObject("payload")
            val headers = payload?.optJSONArray("headers") ?: JSONArray()
            fun header(name: String): String {
                for (i in 0 until headers.length()) {
                    val entry = headers.getJSONObject(i)
                    if (entry.optString("name").equals(name, ignoreCase = true)) return entry.optString("value")
                }
                return ""
            }
            val from = header("from")
            val senderEmail = if ('<' in from) from.substringAfter('<').substringBefore('>').trim() else from.trim()
            val senderName = from.substringBefore('<').trim().trim('"').ifBlank { senderEmail }
            val labels = message.optJSONArray("labelIds") ?: JSONArray()
            val timestamp = message.optString("internalDate").toLongOrNull()
            return EmailMessage(
                messageId = message.getString("id"),
                threadId = message.optString("threadId", message.getString("id")),
                senderName = senderName,
                senderEmail = senderEmail,
                subject = header("subject").ifBlank { "(No subject)" },
                snippet = message.optString("snippet"),
                bodyText = plainText(payload) ?: message.optString("snippet"),
                receivedAtIso = timestamp?.let { Instant.ofEpochMilli(it).toString() }.orEmpty(),
                isUnread = (0 until labels.length()).any { labels.optString(it) == "UNREAD" }
            )
        }

        private fun plainText(part: JSONObject?): String? {
            if (part == null || part.optString("filename").isNotEmpty()) return null
            if (part.optString("mimeType") == "text/plain") {
                val encoded = part.optJSONObject("body")?.optString("data").orEmpty()
                if (encoded.isNotEmpty()) return runCatching {
                    String(Base64.getUrlDecoder().decode(encoded), Charsets.UTF_8)
                }.getOrNull()
            }
            val children = part.optJSONArray("parts") ?: return null
            for (i in 0 until children.length()) plainText(children.optJSONObject(i))?.let { return it }
            return null
        }
    }
}
