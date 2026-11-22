package com.mailbridge.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mailbridge.ai.ui.AccountViewModel
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.mailbridge.ai.ui.theme.MailBridgeBlue
import com.mailbridge.ai.ui.theme.MailBridgeCyan
import com.mailbridge.ai.ui.theme.MailBridgeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            var darkTheme by remember { mutableStateOf(false) }
            MailBridgeTheme(darkTheme = darkTheme) {
                MailBridgeMainScreen(
                    darkTheme = darkTheme,
                    onToggleTheme = { darkTheme = !darkTheme }
                )
            }
        }
    }
}

@Composable
fun MailBridgeLogoMark(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.size(40.dp)) {
        val w = size.width
        val h = size.height
        drawRoundRect(
            color = MailBridgeBlue,
            cornerRadius = CornerRadius(w * 0.25f, h * 0.25f),
            size = size
        )
        drawRoundRect(
            color = Color.White,
            topLeft = Offset(w * 0.19f, h * 0.30f),
            size = Size(w * 0.62f, h * 0.42f),
            cornerRadius = CornerRadius(w * 0.08f, h * 0.08f),
            style = Stroke(width = w * 0.045f)
        )
        val bridgePath = Path().apply {
            moveTo(w * 0.25f, h * 0.69f)
            quadraticTo(w * 0.50f, h * 0.45f, w * 0.75f, h * 0.69f)
        }
        drawPath(
            path = bridgePath,
            color = MailBridgeCyan,
            style = Stroke(width = w * 0.05f, cap = StrokeCap.Round)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MailBridgeMainScreen(
    darkTheme: Boolean,
    onToggleTheme: () -> Unit
) {
    val account: AccountViewModel = viewModel()
    val state by account.state.collectAsState()
    val activity = LocalContext.current as ComponentActivity
    val consent = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) {
        account.consentResult(activity, it.resultCode, it.data)
    }
    val connect: () -> Unit = {
        account.connectGmail(activity) { consent.launch(IntentSenderRequest.Builder(it.intentSender).build()) }
    }
    if (state.email == null) {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                MailBridgeLogoMark()
                Spacer(Modifier.height(20.dp))
                Text("Welcome to MailBridge AI", style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(12.dp))
                Text("Sign in with your Google account. You can connect Gmail separately with read-only permission.")
                Spacer(Modifier.height(24.dp))
                Button(onClick = { account.signIn(activity) }, enabled = !state.busy) {
                    Text(if (state.busy) "Signing in…" else "Sign in with Google")
                }
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 16.dp)) }
            }
        }
        return
    }
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: "home"

    val tabs = listOf(
        Triple("home", "Home", Icons.Default.Home),
        Triple("inbox", "Inbox", Icons.Default.Inbox),
        Triple("insights", "AI Insights", Icons.Default.AutoAwesome),
        Triple("alerts", "Alerts", Icons.Default.Notifications),
        Triple("settings", "Settings", Icons.Default.Settings)
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        MailBridgeLogoMark(modifier = Modifier.size(32.dp))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text("MailBridge AI", fontWeight = FontWeight.Bold)
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                tabs.forEach { (route, label, icon) ->
                    NavigationBarItem(
                        selected = currentRoute == route,
                        onClick = {
                            navController.navigate(route) {
                                popUpTo("home") { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label, maxLines = 1) }
                    )
                }
            }
        }
    ) { padding ->
        Column(Modifier.padding(padding)) {
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp)) }
        if (state.busy) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        NavHost(
            navController = navController,
            startDestination = "home",
            modifier = Modifier.weight(1f)
        ) {
            composable("home") {
                Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
                    Text("Dashboard", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Signed in as ${state.email}")
                    Spacer(Modifier.height(16.dp))
                    Text(if (state.gmailConnected) "Gmail connected · ${state.messages.size} recent emails" else "Connect Gmail to view your recent emails. MailBridge cannot send, change, or delete your mail.")
                    Button(onClick = connect, enabled = !state.busy, modifier = Modifier.padding(top = 16.dp)) {
                        Text(if (state.gmailConnected) "Refresh inbox" else "Connect Gmail")
                    }
                }
            }
            composable("inbox") {
                Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
                    Text("Inbox", style = MaterialTheme.typography.headlineSmall)
                    Text(state.email.orEmpty())
                    Button(onClick = connect, enabled = !state.busy) {
                        Text(if (state.gmailConnected) "Refresh inbox" else "Connect Gmail")
                    }
                    if (state.gmailConnected && state.messages.isEmpty()) Text("Your inbox is empty.")
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.messages, key = { it.messageId }) { message ->
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(16.dp)) {
                                    Text(message.senderName, fontWeight = FontWeight.Bold)
                                    Text(message.subject, style = MaterialTheme.typography.titleMedium)
                                    Text(message.snippet, maxLines = 4)
                                    if (message.isUnread) Text("Unread", color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                    }
                }
            }
            composable("insights") {
                Box(modifier = Modifier.fillMaxSize().padding(20.dp)) {
                    Text("AI Insights & Extracted Deadlines")
                }
            }
            composable("alerts") {
                Box(modifier = Modifier.fillMaxSize().padding(20.dp)) {
                    Text("Mobile Push (FCM) & WhatsApp Business Cloud API Alerts")
                }
            }
            composable("settings") {
                Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
                    Text("Google account", style = MaterialTheme.typography.titleMedium)
                    Text(state.email.orEmpty())
                    Text(if (state.gmailConnected) "Gmail connected (read-only)" else "Gmail not connected")
                    Button(onClick = connect, enabled = !state.busy) { Text("Connect / refresh Gmail") }
                    OutlinedButton(onClick = account::signOut, enabled = !state.busy) { Text("Sign out") }
                    Text("Signing out clears mail from this app. To revoke Gmail permission, remove MailBridge in your Google Account's third-party connections.", style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(16.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Dark Mode", modifier = Modifier.weight(1f))
                        Switch(checked = darkTheme, onCheckedChange = { onToggleTheme() })
                    }
                }
            }
        }
        }
    }
}
