package com.mailbridge.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
        NavHost(
            navController = navController,
            startDestination = "home",
            modifier = Modifier.padding(padding)
        ) {
            composable("home") {
                Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
                    Text("Dashboard", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Connect Google Sign-In and Gmail Read-Only OAuth to begin AI triage.")
                }
            }
            composable("inbox") {
                Box(modifier = Modifier.fillMaxSize().padding(20.dp)) {
                    Text("Smart Gmail Inbox — Urgent / Important / Normal / Promotions")
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Dark Mode", modifier = Modifier.weight(1f))
                        Switch(checked = darkTheme, onCheckedChange = { onToggleTheme() })
                    }
                }
            }
        }
    }
}
