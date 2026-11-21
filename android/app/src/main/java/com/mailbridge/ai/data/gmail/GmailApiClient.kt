package com.mailbridge.ai.data.gmail

import com.mailbridge.ai.domain.EmailMessage
import com.mailbridge.ai.domain.EmailProviderClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class GmailApiClient(
    private val httpClient: OkHttpClient = OkHttpClient()
) : EmailProviderClient {
    override val providerId: String = "gmail"

    override suspend fun fetchRecentMessages(
        accessToken: String,
        maxResults: Int
    ): Result<List<EmailMessage>> = withContext(Dispatchers.IO) {
        runCatching {
            val listReq = Request.Builder()
                .url("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=$maxResults&labelIds=INBOX")
                .addHeader("Authorization", "Bearer $accessToken")
                .get()
                .build()

            val listResp = httpClient.newCall(listReq).execute()
            if (!listResp.isSuccessful) {
                error("Gmail API returned HTTP ${listResp.code}")
            }
            val listJson = JSONObject(listResp.body?.string().orEmpty())
            val refs = listJson.optJSONArray("messages") ?: return@runCatching emptyList()

            val results = mutableListOf<EmailMessage>()
            for (i in 0 until refs.length()) {
                val id = refs.getJSONObject(i).getString("id")
                val detailReq = Request.Builder()
                    .url("https://gmail.googleapis.com/gmail/v1/users/me/messages/$id?format=full")
                    .addHeader("Authorization", "Bearer $accessToken")
                    .get()
                    .build()
                val detailResp = httpClient.newCall(detailReq).execute()
                if (!detailResp.isSuccessful) continue

                val msgJson = JSONObject(detailResp.body?.string().orEmpty())
                val headers = msgJson.optJSONObject("payload")?.optJSONArray("headers")
                var fromHeader = ""
                var subjectHeader = "(No subject)"
                if (headers != null) {
                    for (h in 0 until headers.length()) {
                        val entry = headers.getJSONObject(h)
                        when (entry.optString("name").lowercase()) {
                            "from" -> fromHeader = entry.optString("value")
                            "subject" -> subjectHeader = entry.optString("value").ifBlank { "(No subject)" }
                        }
                    }
                }
                val labels = msgJson.optJSONArray("labelIds")
                var isUnread = false
                if (labels != null) {
                    for (l in 0 until labels.length()) {
                        if (labels.getString(l) == "UNREAD") isUnread = true
                    }
                }
                results += EmailMessage(
                    messageId = msgJson.getString("id"),
                    threadId = msgJson.optString("threadId", id),
                    senderName = fromHeader.substringBefore("<").trim().ifBlank { fromHeader },
                    senderEmail = fromHeader.substringAfter("<", "").substringBefore(">").trim(),
                    subject = subjectHeader,
                    snippet = msgJson.optString("snippet"),
                    bodyText = msgJson.optString("snippet"),
                    receivedAtIso = msgJson.optString("internalDate"),
                    isUnread = isUnread
                )
            }
            results
        }
    }

    override suspend fun registerWatch(accessToken: String, topicName: String): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val payload = JSONObject().apply {
                    put("topicName", topicName)
                    put("labelIds", listOf("INBOX"))
                }.toString()

                val req = Request.Builder()
                    .url("https://gmail.googleapis.com/gmail/v1/users/me/watch")
                    .addHeader("Authorization", "Bearer $accessToken")
                    .post(payload.toRequestBody("application/json".toMediaType()))
                    .build()

                val resp = httpClient.newCall(req).execute()
                if (!resp.isSuccessful) error("Watch registration failed: HTTP ${resp.code}")
                JSONObject(resp.body?.string().orEmpty()).optString("historyId")
            }
        }
}
