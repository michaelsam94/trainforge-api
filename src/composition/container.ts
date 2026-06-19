import { GetCurrentUserUseCase } from "@/application/use-cases/GetCurrentUserUseCase";
import { LoginUserUseCase } from "@/application/use-cases/LoginUserUseCase";
import { LogoutUserUseCase } from "@/application/use-cases/LogoutUserUseCase";
import {
  BuildManualPlanUseCase,
  GeneratePlanUseCase,
  GetCurrentPlanUseCase,
  GetPlanByIdUseCase,
} from "@/application/use-cases/PlanUseCases";
import { DeleteAccountUseCase } from "@/application/use-cases/DeleteAccountUseCase";
import { RegisterUserUseCase } from "@/application/use-cases/RegisterUserUseCase";
import { SaveOnboardingUseCase } from "@/application/use-cases/SaveOnboardingUseCase";
import {
  AdaptPlanUseCase,
  CompleteWorkoutUseCase,
  GetWorkoutAdherenceUseCase,
  LogWorkoutUseCase,
  SyncOfflineWorkoutsUseCase,
} from "@/application/use-cases/WorkoutUseCases";
import {
  EvaluateBadgesUseCase,
  GetProgressSummaryUseCase,
  GetStreaksUseCase,
  GetWorkoutHistoryUseCase,
} from "@/application/use-cases/ProgressUseCases";
import {
  ConnectWearableUseCase,
  GetRecoverySignalsUseCase,
  GetWearableMetricsUseCase,
  SyncWearableMetricsUseCase,
} from "@/application/use-cases/WearableUseCases";
import { AnthropicChatStreamer } from "@/infrastructure/ai/AnthropicChatStreamer";
import { AnthropicPlanGenerator } from "@/infrastructure/ai/AnthropicPlanGenerator";
import { StubChatStreamer } from "@/infrastructure/ai/StubChatStreamer";
import { StubPlanGenerator } from "@/infrastructure/ai/StubPlanGenerator";
import { KvChatRateLimiter } from "@/infrastructure/chat/KvChatRateLimiter";
import { WebCryptoPasswordHasher } from "@/infrastructure/auth/WebCryptoPasswordHasher";
import { D1ChatRepository } from "@/infrastructure/persistence/D1ChatRepository";
import { D1OnboardingRepository } from "@/infrastructure/persistence/D1OnboardingRepository";
import { D1PlanAdapter } from "@/infrastructure/persistence/D1PlanAdapter";
import { D1PlanRepository } from "@/infrastructure/persistence/D1PlanRepository";
import { D1ProgressRepository } from "@/infrastructure/persistence/D1ProgressRepository";
import { D1SessionRepository } from "@/infrastructure/persistence/D1SessionRepository";
import { D1UserRepository } from "@/infrastructure/persistence/D1UserRepository";
import {
  CreateChatSessionUseCase,
  GetChatMessagesUseCase,
  ListChatSessionsUseCase,
  StreamChatMessageUseCase,
} from "@/application/use-cases/ChatUseCases";
import { FitbitWearableProvider } from "@/infrastructure/wearables/FitbitWearableProvider";
import { KvOAuthStateStore } from "@/infrastructure/wearables/KvOAuthStateStore";
import {
  StubAppleHealthProvider,
  StubGarminProvider,
} from "@/infrastructure/wearables/StubWearableProviders";
import {
  D1WearableConnectionRepository,
  D1WearableMetricRepository,
} from "@/infrastructure/persistence/D1WearableRepository";
import {
  CompleteStubCheckoutUseCase,
  CreateCheckoutSessionUseCase,
  CreatePortalSessionUseCase,
  GetSubscriptionUseCase,
  HandleStripeWebhookUseCase,
} from "@/application/use-cases/BillingUseCases";
import { createBillingClient } from "@/infrastructure/billing/StripeBillingClient";
import {
  D1SubscriptionRepository,
  D1UserBillingRepository,
} from "@/infrastructure/persistence/D1SubscriptionRepository";
import {
  CreatePostUseCase,
  CreateThreadUseCase,
  GetThreadUseCase,
  ListThreadsUseCase,
} from "@/application/use-cases/CommunityUseCases";
import { D1CommunityRepository } from "@/infrastructure/persistence/D1CommunityRepository";
import { D1ExerciseRepository } from "@/infrastructure/persistence/D1ExerciseRepository";
import { D1WorkoutRepository } from "@/infrastructure/persistence/D1WorkoutRepository";
import {
  GetExerciseUseCase,
  ListExercisesUseCase,
} from "@/application/use-cases/ExerciseUseCases";

export function createContainer(env: Env) {
  const users = new D1UserRepository(env.DB);
  const sessions = new D1SessionRepository(env.DB);
  const onboarding = new D1OnboardingRepository(env.DB);
  const plans = new D1PlanRepository(env.DB);
  const workouts = new D1WorkoutRepository(env.DB);
  const progress = new D1ProgressRepository(env.DB);
  const chat = new D1ChatRepository(env.DB);
  const wearableConnections = new D1WearableConnectionRepository(env.DB);
  const wearableMetrics = new D1WearableMetricRepository(env.DB);
  const planAdapter = new D1PlanAdapter(env.DB);
  const subscriptions = new D1SubscriptionRepository(env.DB);
  const userBilling = new D1UserBillingRepository(env.DB);
  const community = new D1CommunityRepository(env.DB);
  const exercises = new D1ExerciseRepository(env.DB);
  const billingClient = createBillingClient(env);
  const passwordHasher = new WebCryptoPasswordHasher();

  const planGenerator = new AnthropicPlanGenerator(
    env.ANTHROPIC_API_KEY ?? "",
    new StubPlanGenerator(),
  );
  const chatStreamer = new AnthropicChatStreamer(env.ANTHROPIC_API_KEY ?? "", new StubChatStreamer());
  const chatRateLimiter = new KvChatRateLimiter(env.CACHE);
  const oauthState = new KvOAuthStateStore(env.CACHE);
  const fitbitProvider = new FitbitWearableProvider(
    env.FITBIT_CLIENT_ID ?? "",
    env.FITBIT_CLIENT_SECRET ?? "",
  );
  const wearableProviders = {
    fitbit: fitbitProvider,
    garmin: new StubGarminProvider(),
    apple_health: new StubAppleHealthProvider(),
  };

  const registerUser = new RegisterUserUseCase(users, sessions, passwordHasher);
  const deleteAccount = new DeleteAccountUseCase(users, sessions);
  const loginUser = new LoginUserUseCase(users, sessions, onboarding, passwordHasher);
  const logoutUser = new LogoutUserUseCase(sessions);
  const getCurrentUser = new GetCurrentUserUseCase(sessions, users, onboarding, subscriptions);
  const saveOnboarding = new SaveOnboardingUseCase(onboarding);
  const generatePlan = new GeneratePlanUseCase(plans, onboarding, planGenerator);
  const buildManualPlan = new BuildManualPlanUseCase(plans, onboarding, exercises);
  const getCurrentPlan = new GetCurrentPlanUseCase(plans);
  const getPlanById = new GetPlanByIdUseCase(plans);
  const logWorkout = new LogWorkoutUseCase(workouts, plans);
  const completeWorkout = new CompleteWorkoutUseCase(workouts);
  const syncOfflineWorkouts = new SyncOfflineWorkoutsUseCase(logWorkout, completeWorkout);
  const getRecoverySignals = new GetRecoverySignalsUseCase(wearableMetrics);
  const connectWearable = new ConnectWearableUseCase(oauthState, wearableProviders);
  const syncWearableMetrics = new SyncWearableMetricsUseCase(
    wearableConnections,
    wearableMetrics,
    wearableProviders,
  );
  const getWearableMetrics = new GetWearableMetricsUseCase(wearableConnections, wearableMetrics);
  const adaptPlan = new AdaptPlanUseCase(workouts, plans, planAdapter, getRecoverySignals);
  const getWorkoutAdherence = new GetWorkoutAdherenceUseCase(workouts);
  const getProgressSummary = new GetProgressSummaryUseCase(progress);
  const getStreaks = new GetStreaksUseCase(progress);
  const getWorkoutHistory = new GetWorkoutHistoryUseCase(progress);
  const evaluateBadges = new EvaluateBadgesUseCase(progress, onboarding);
  const listChatSessions = new ListChatSessionsUseCase(chat);
  const createChatSession = new CreateChatSessionUseCase(chat);
  const getChatMessages = new GetChatMessagesUseCase(chat);
  const streamChatMessage = new StreamChatMessageUseCase(
    chat,
    onboarding,
    chatStreamer,
    chatRateLimiter,
  );
  const getSubscription = new GetSubscriptionUseCase(subscriptions);
  const createCheckoutSession = new CreateCheckoutSessionUseCase(users, userBilling, billingClient);
  const createPortalSession = new CreatePortalSessionUseCase(userBilling, billingClient);
  const handleStripeWebhook = new HandleStripeWebhookUseCase(
    subscriptions,
    userBilling,
    billingClient,
  );
  const completeStubCheckout = new CompleteStubCheckoutUseCase(subscriptions);
  const listThreads = new ListThreadsUseCase(community);
  const getThread = new GetThreadUseCase(community);
  const createThread = new CreateThreadUseCase(community);
  const createPost = new CreatePostUseCase(community);
  const listExercises = new ListExercisesUseCase(exercises);
  const getExercise = new GetExerciseUseCase(exercises);

  return {
    registerUser,
    deleteAccount,
    loginUser,
    logoutUser,
    getCurrentUser,
    saveOnboarding,
    generatePlan,
    buildManualPlan,
    getCurrentPlan,
    getPlanById,
    logWorkout,
    completeWorkout,
    syncOfflineWorkouts,
    adaptPlan,
    getWorkoutAdherence,
    getProgressSummary,
    getStreaks,
    getWorkoutHistory,
    evaluateBadges,
    listChatSessions,
    createChatSession,
    getChatMessages,
    streamChatMessage,
    connectWearable,
    syncWearableMetrics,
    getWearableMetrics,
    getRecoverySignals,
    wearableConnections,
    getSubscription,
    createCheckoutSession,
    createPortalSession,
    handleStripeWebhook,
    completeStubCheckout,
    listThreads,
    getThread,
    createThread,
    createPost,
    listExercises,
    getExercise,
    exercises,
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
