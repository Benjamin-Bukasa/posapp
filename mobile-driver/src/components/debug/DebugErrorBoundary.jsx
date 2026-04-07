import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import useDebugStore from "../../stores/debugStore";
import { serializeErrorForLog } from "../../utils/errorHandling";

class DebugErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      info: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    useDebugStore.getState().addLog({
      level: "error",
      scope: "render",
      message: error?.message || "Erreur de rendu React Native",
      details: {
        ...serializeErrorForLog(error, "Erreur de rendu React Native"),
        componentStack: info?.componentStack || null,
      },
    });

    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
    this.props.onReset?.();
  };

  render() {
    const { error, info } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.badge}>Crash de l'application</Text>
          <Text style={styles.title}>Un ecran a plante dans Expo Go.</Text>
          <Text style={styles.message}>
            {error?.message || "Erreur inconnue de rendu"}
          </Text>
          <Text style={styles.help}>
            Regarde aussi le panneau Debug dans l'application pour voir le detail de
            la derniere erreur.
          </Text>

          {info?.componentStack ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Component stack</Text>
              <Text style={styles.blockText}>{info.componentStack}</Text>
            </View>
          ) : null}

          {error?.stack ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Stack</Text>
              <Text style={styles.blockText}>{error.stack}</Text>
            </View>
          ) : null}

          <Pressable onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonText}>Reessayer</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#130f18",
  },
  content: {
    padding: 24,
    gap: 16,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#ffffff",
    backgroundColor: "#8f1d3c",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
  },
  message: {
    fontSize: 16,
    color: "#ffd9e2",
  },
  help: {
    fontSize: 14,
    lineHeight: 22,
    color: "#d3c6dd",
  },
  block: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#201728",
  },
  blockTitle: {
    marginBottom: 8,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  blockText: {
    color: "#d3c6dd",
    fontSize: 12,
  },
  button: {
    marginTop: 8,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#f26b8a",
  },
  buttonText: {
    color: "#130f18",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default DebugErrorBoundary;
