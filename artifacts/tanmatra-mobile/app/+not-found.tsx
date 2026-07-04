import {Link, Stack} from 'expo-router';
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useColors} from '@/hooks/useColors';

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{title: 'Page not found'}} />
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        <Text style={[styles.title, {color: colors.foreground}]}>
          We couldn’t find that screen.
        </Text>
        <Text style={[styles.subtitle, {color: colors.zinc}]}>
          Let’s get you back to activity sync.
        </Text>

        <Link href="/" asChild>
          <Pressable
            style={[
              styles.button,
              {backgroundColor: colors.primary, borderColor: colors.primary},
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go to home screen">
            <Text style={[styles.buttonText, {color: '#050505'}]}>
              Go to home
            </Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 20,
    minWidth: 160,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
