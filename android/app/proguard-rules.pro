# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

-keepattributes SourceFile,LineNumberTable

# Capacitor - 리플렉션으로 로드되는 클래스 보호
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.annotation.PluginMethod public <methods>;
    public <init>();
}
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
# WebView JavaScript Interface 보호
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 앱 패키지 보호
-keep class com.wjedulab.gridshift.v2.** { *; }
