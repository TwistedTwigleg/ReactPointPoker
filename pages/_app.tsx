import '@mantine/core/styles.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { MantineProvider } from '@mantine/core';
import '@mantine/notifications/styles.css';
import { Notifications } from '@mantine/notifications';


export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider>
      <Notifications></Notifications>
      <Head>
        <title>React Point Poker</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
        <link rel="icon" href="/favicon.png" />
      </Head>
      <Component {...pageProps} />
    </MantineProvider>
  );
}
