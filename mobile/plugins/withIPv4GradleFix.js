const { withGradleProperties } = require("@expo/config-plugins");

// This dev machine's network can't route IPv6, but some Maven mirrors return IPv6-first
// DNS records, which makes Gradle's dependency downloads fail intermittently with
// "No such host is known" even though the network is otherwise fine. Forcing the JVM to
// prefer IPv4 avoids that. Done as a config plugin (not a manual gradle.properties edit)
// because `expo prebuild --clean` regenerates that file from scratch every time.
module.exports = function withIPv4GradleFix(config) {
  return withGradleProperties(config, (config) => {
    const jvmArgs = config.modResults.find(
      (item) => item.type === "property" && item.key === "org.gradle.jvmargs"
    );
    if (jvmArgs && !jvmArgs.value.includes("preferIPv4Stack")) {
      jvmArgs.value += " -Djava.net.preferIPv4Stack=true";
    }
    return config;
  });
};
