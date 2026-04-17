import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CATEGORIES, SKYSCRAPERS } from './src/skyscrapers';

const QUESTIONS_PER_ROUND = 10;
const BEST_SCORE_KEY = '@monolith/best_score';
const FEEDBACK_MS = 900;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildQuestion(target, category) {
  const correct = target[category];
  const seen = new Set([String(correct)]);
  const distractors = [];

  const others = shuffle(SKYSCRAPERS.filter((s) => s !== target));
  for (const s of others) {
    const v = s[category];
    const key = String(v);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(v);
    if (distractors.length === 3) break;
  }

  // Numeric fallback: perturb the correct value if the pool is too small.
  while (distractors.length < 3 && typeof correct === 'number') {
    const spread = Math.max(2, Math.round(Math.abs(correct) * 0.08));
    const delta = Math.floor((Math.random() - 0.5) * spread * 4);
    const v = correct + (delta === 0 ? spread : delta);
    const key = String(v);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(v);
  }

  return {
    target,
    category,
    correct,
    options: shuffle([correct, ...distractors]),
  };
}

function generateRound() {
  const picks = shuffle(SKYSCRAPERS).slice(0, QUESTIONS_PER_ROUND);
  return picks.map((t) => buildQuestion(t, pickRandom(CATEGORIES).key));
}

function categoryLabel(key) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function formatValue(category, value) {
  if (category === 'height') return `${value} m`;
  return String(value);
}

function categoryPrompt(key) {
  switch (key) {
    case 'name':
      return 'What is this skyscraper?';
    case 'country':
      return 'Which country is it in?';
    case 'height':
      return 'How tall is it?';
    case 'floors':
      return 'How many floors does it have?';
    case 'year':
      return 'When was it completed?';
    default:
      return 'Pick the correct answer.';
  }
}

export default function App() {
  const [screen, setScreen] = useState('home'); // 'home' | 'quiz' | 'result'
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [locked, setLocked] = useState(false);
  const [bestScore, setBestScore] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(BEST_SCORE_KEY)
      .then((v) => {
        if (v != null) setBestScore(parseInt(v, 10) || 0);
      })
      .catch(() => {});
  }, []);

  const startRound = useCallback(() => {
    setQuestions(generateRound());
    setIndex(0);
    setScore(0);
    setSelected(null);
    setLocked(false);
    setScreen('quiz');
  }, []);

  const handleSelect = useCallback(
    (option) => {
      if (locked) return;
      setLocked(true);
      setSelected(option);
      const current = questions[index];
      const correct = option === current.correct;
      const newScore = correct ? score + 1 : score;
      if (correct) setScore(newScore);

      setTimeout(() => {
        const next = index + 1;
        if (next >= questions.length) {
          if (newScore > bestScore) {
            setBestScore(newScore);
            AsyncStorage.setItem(BEST_SCORE_KEY, String(newScore)).catch(
              () => {},
            );
          }
          setScreen('result');
        } else {
          setIndex(next);
          setSelected(null);
          setLocked(false);
        }
      }, FEEDBACK_MS);
    },
    [index, questions, score, bestScore, locked],
  );

  const goHome = useCallback(() => setScreen('home'), []);

  if (screen === 'home') {
    return <HomeScreen bestScore={bestScore} onStart={startRound} />;
  }

  if (screen === 'quiz') {
    const current = questions[index];
    return (
      <QuizScreen
        question={current}
        index={index}
        total={questions.length}
        score={score}
        selected={selected}
        locked={locked}
        imageSource={current.target.image}
        onSelect={handleSelect}
        onQuit={goHome}
      />
    );
  }

  return (
    <ResultScreen
      score={score}
      total={questions.length}
      bestScore={bestScore}
      onPlayAgain={startRound}
      onHome={goHome}
    />
  );
}

function HomeScreen({ bestScore, onStart }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.homeContainer}>
        <Text style={styles.brand}>MONOLITH</Text>
        <Text style={styles.tagline}>Skyscraper flash cards</Text>

        <View style={styles.heroBlock}>
          <Text style={styles.heroGlyph}>▮</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Round</Text>
            <Text style={styles.statValue}>{QUESTIONS_PER_ROUND} Qs</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Best score</Text>
            <Text style={styles.statValue}>
              {bestScore}/{QUESTIONS_PER_ROUND}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Towers</Text>
            <Text style={styles.statValue}>{SKYSCRAPERS.length}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={onStart}
        >
          <Text style={styles.primaryBtnText}>Start round</Text>
        </Pressable>

        <Text style={styles.footer}>
          Identify the skyscraper by its name, country, height, floors, or year.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function QuizScreen({
  question,
  index,
  total,
  score,
  selected,
  locked,
  imageSource,
  onSelect,
  onQuit,
}) {
  const progress = (index + 1) / total;
  const prompt = useMemo(
    () => categoryPrompt(question.category),
    [question.category],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.quizContainer}>
        <View style={styles.topBar}>
          <Pressable hitSlop={12} onPress={onQuit}>
            <Text style={styles.quitText}>✕ Quit</Text>
          </Pressable>
          <Text style={styles.progressText}>
            {index + 1} / {total}
          </Text>
          <Text style={styles.scoreText}>Score {score}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.imageWrap}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, styles.imageFallback]}>
              <Text style={styles.imageFallbackGlyph}>▮</Text>
            </View>
          )}
        </View>

        <Text style={styles.categoryTag}>
          {categoryLabel(question.category)}
        </Text>
        <Text style={styles.questionPrompt}>{prompt}</Text>

        <View style={styles.options}>
          {question.options.map((opt) => {
            const isSelected = selected === opt;
            const isCorrect = opt === question.correct;
            let optStyle = styles.option;
            let textStyle = styles.optionText;
            if (locked) {
              if (isCorrect) {
                optStyle = [styles.option, styles.optionCorrect];
                textStyle = [styles.optionText, styles.optionTextCorrect];
              } else if (isSelected) {
                optStyle = [styles.option, styles.optionWrong];
                textStyle = [styles.optionText, styles.optionTextWrong];
              } else {
                optStyle = [styles.option, styles.optionDim];
              }
            }
            return (
              <Pressable
                key={String(opt)}
                style={({ pressed }) => [
                  optStyle,
                  pressed && !locked && styles.optionPressed,
                ]}
                onPress={() => onSelect(opt)}
                disabled={locked}
              >
                <Text style={textStyle}>
                  {formatValue(question.category, opt)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultScreen({ score, total, bestScore, onPlayAgain, onHome }) {
  const perfect = score === total;
  const newBest = score >= bestScore && score > 0;
  const headline = perfect
    ? 'Perfect round!'
    : score >= total * 0.7
      ? 'Great round'
      : score >= total * 0.4
        ? 'Not bad'
        : 'Tough one';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.resultContainer}>
        <Text style={styles.resultHeadline}>{headline}</Text>
        <Text style={styles.resultScore}>
          {score}
          <Text style={styles.resultScoreTotal}>/{total}</Text>
        </Text>

        {perfect && <Text style={styles.perfect}>★ 10/10 ★</Text>}
        {newBest && !perfect && (
          <Text style={styles.newBest}>New best score</Text>
        )}

        <View style={styles.resultBest}>
          <Text style={styles.statLabel}>Best score</Text>
          <Text style={styles.statValue}>
            {bestScore}/{total}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={onPlayAgain}
        >
          <Text style={styles.primaryBtnText}>Play again</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && styles.secondaryBtnPressed,
          ]}
          onPress={onHome}
        >
          <Text style={styles.secondaryBtnText}>Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  homeContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: 'stretch',
  },
  brand: {
    color: '#f5f5f7',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    marginTop: 12,
  },
  tagline: {
    color: '#9aa5b1',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  heroBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlyph: {
    color: '#1f2933',
    fontSize: 220,
    lineHeight: 220,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    backgroundColor: '#141416',
    borderRadius: 12,
  },
  statLabel: {
    color: '#6b7380',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    color: '#f5f5f7',
    fontSize: 18,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: '#f5f5f7',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnPressed: {
    backgroundColor: '#d0d0d4',
  },
  primaryBtnText: {
    color: '#0a0a0a',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
  },
  secondaryBtn: {
    borderColor: '#2a2a2e',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnPressed: {
    backgroundColor: '#141416',
  },
  secondaryBtnText: {
    color: '#f5f5f7',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 1,
  },
  footer: {
    color: '#6b7380',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
  },
  quizContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quitText: {
    color: '#6b7380',
    fontSize: 14,
    fontWeight: '600',
  },
  progressText: {
    color: '#9aa5b1',
    fontSize: 13,
    fontWeight: '600',
  },
  scoreText: {
    color: '#f5f5f7',
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1a1a1d',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f5f5f7',
  },
  imageWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#141416',
    aspectRatio: 3 / 4,
    marginBottom: 18,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackGlyph: {
    color: '#1f2933',
    fontSize: 160,
  },
  categoryTag: {
    color: '#6b7380',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 6,
  },
  questionPrompt: {
    color: '#f5f5f7',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 18,
  },
  options: {
    gap: 10,
  },
  option: {
    backgroundColor: '#141416',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#1f1f22',
  },
  optionPressed: {
    backgroundColor: '#1c1c1f',
  },
  optionDim: {
    opacity: 0.45,
  },
  optionCorrect: {
    backgroundColor: '#0f2a19',
    borderColor: '#2ecc71',
  },
  optionWrong: {
    backgroundColor: '#2a0f15',
    borderColor: '#e74c3c',
  },
  optionText: {
    color: '#f5f5f7',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextCorrect: {
    color: '#7fe3a8',
  },
  optionTextWrong: {
    color: '#f59b8e',
  },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  resultHeadline: {
    color: '#9aa5b1',
    fontSize: 14,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  resultScore: {
    color: '#f5f5f7',
    fontSize: 96,
    fontWeight: '800',
    letterSpacing: -2,
  },
  resultScoreTotal: {
    color: '#6b7380',
    fontSize: 48,
    fontWeight: '700',
  },
  perfect: {
    color: '#ffd166',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 4,
    marginBottom: 18,
  },
  newBest: {
    color: '#7fe3a8',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 18,
  },
  resultBest: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#141416',
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 28,
    alignSelf: 'stretch',
  },
});
