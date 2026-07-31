/**
 * Единый словарь пользовательских надписей (UI).
 */
export const LABELS = {
  BRAND_NAME: 'Lingua-Bloom',
  BRAND_LOGO_ALT: 'Lingua-Bloom',
  CHAT_WITH_AI: 'Чат с ИИ',
  NAV_HISTORY_TESTS: 'История тестов',
  NAV_TELEGRAM_SETTINGS: 'Настройки профиля',
  SIGN_OUT: 'Выход',

  HISTORY_SUBTITLE: 'Созданные интерактивные тесты',
  HISTORY_NEW_LESSON: 'Новый тест',
  HISTORY_LESSONS_EMPTY_TITLE: 'Пока нет тестов',
  HISTORY_LESSONS_EMPTY_DESC: 'Создайте интерактивный тест из текста или PDF в чате с ИИ.',
  HISTORY_OPEN: 'Открыть',
  HISTORY_DELETE_ARIA: 'Удалить тест',
  HISTORY_DELETE_CONFIRM: 'Удалить этот тест? Действие нельзя отменить.',
  HISTORY_DELETE_ERROR: 'Не удалось удалить тест. Попробуйте ещё раз.',

  META_TITLE_DEFAULT: 'Lingua-Bloom — интерактивные тесты с ИИ',
  META_TITLE_TEMPLATE: '%s | Lingua-Bloom',
  META_DESCRIPTION:
    'Платформа, где языковое обучение расцветает: тесты из идей, PDF и изображений за минуты. Персонализация, проверка заданий и мотивирующий интерфейс.',
  META_KEYWORD_1: 'Lingua-Bloom',
  META_KEYWORD_2: 'изучение языков',
  META_KEYWORD_3: 'ИИ тесты',
  META_KEYWORD_4: 'интерактивное обучение',
  META_KEYWORD_5: 'AI lessons',
  META_AUTHOR_NAME: 'Lingua-Bloom',
  META_OG_TITLE: 'Lingua-Bloom — интерактивные тесты с ИИ',
  META_OG_DESCRIPTION:
    'Пусть ваши возможности расцветают с нашими AI-решениями: тесты, упражнения и обратная связь.',
  META_TWITTER_TITLE: 'Lingua-Bloom — интерактивные тесты с ИИ',
  META_TWITTER_DESCRIPTION: 'Идеи и материалы превращаются в интерактивные тесты за минуты.',

  CREATE_ERROR_EMPTY: 'Пустой ответ',
  CREATE_ERROR_GENERIC: 'Ошибка',
  CREATE_ERROR_GENERATION: 'Ошибка генерации',
  CREATE_ERROR_NEED_MESSAGE: 'Нужен текст материала или загруженный PDF.',

  UPLOAD_LABEL_TITLE: 'Заголовок',
  UPLOAD_TITLE_PLACEHOLDER: 'Например: Путешествия — лексика',

  AUTH_BRAND_DISPLAY: 'Lingua Bloom',
  AUTH_BRAND_LOGO_ALT: 'Lingua Bloom',
  AUTH_LOGIN_TAGLINE: 'Welcome back! Sign in to continue.',
  AUTH_SIGN_IN_TITLE: 'Sign In',
  AUTH_SIGN_IN_DESCRIPTION: 'Enter your email and password to access your account',
  AUTH_OR_EMAIL: 'or with email',
  AUTH_EMAIL_LABEL: 'Email',
  AUTH_EMAIL_PLACEHOLDER: 'you@example.com',
  AUTH_PASSWORD_LABEL: 'Password',
  AUTH_PASSWORD_PLACEHOLDER: 'Enter your password',
  AUTH_SIGNING_IN: 'Signing in...',
  AUTH_SIGN_IN_SUBMIT: 'Sign In',
  AUTH_NO_ACCOUNT: "Don't have an account?",
  AUTH_SIGN_UP_LINK: 'Sign up',

  AUTH_SIGNUP_TAGLINE: 'Для учителей и репетиторов — урок на раз-два',
  AUTH_SIGNUP_TITLE: 'Создать аккаунт',
  AUTH_SIGNUP_DESCRIPTION:
    'Зарегистрируйтесь, чтобы превращать текст и PDF в интерактивные тесты за минуты.',
  AUTH_SIGNUP_PITCH_TITLE: 'Что умеет Lingua-Bloom',
  AUTH_SIGNUP_PITCH_AUDIENCE:
    'Сервис для учителей и репетиторов: из материала — готовый урок «на раз-два».',
  AUTH_SIGNUP_PITCH_1: 'Текст или PDF → интерактивный HTML-тест с проверкой ответов',
  AUTH_SIGNUP_PITCH_2: 'ИИ сам выбирает сценарий: готовые задания извлечь или спланировать урок',
  AUTH_SIGNUP_PITCH_3: 'Вы правите план и эталоны — или доверяете авто-ответам модели',
  AUTH_SIGNUP_PITCH_4: 'История тестов и мгновенный просмотр в браузере',
  AUTH_GOOGLE_SIGN_UP: 'Sign up with Google',
  AUTH_GOOGLE_CONTINUE: 'Continue with Google',
  AUTH_DISPLAY_NAME_LABEL: 'Display Name',
  AUTH_DISPLAY_NAME_PLACEHOLDER: 'Your name',
  AUTH_PASSWORD_CREATE_PLACEHOLDER: 'Create a password (min. 6 characters)',
  AUTH_CONFIRM_PASSWORD_LABEL: 'Confirm Password',
  AUTH_CONFIRM_PASSWORD_PLACEHOLDER: 'Confirm your password',
  AUTH_CREATING_ACCOUNT: 'Creating account...',
  AUTH_CREATE_ACCOUNT_SUBMIT: 'Create Account',
  AUTH_HAVE_ACCOUNT: 'Already have an account?',
  AUTH_SIGN_IN_LINK: 'Sign in',
  AUTH_PASSWORD_MISMATCH: 'Passwords do not match',
  AUTH_PASSWORD_MIN_LENGTH: 'Password must be at least 6 characters',

  AUTH_EMAIL_CHECK_TITLE: 'Check Your Email',
  AUTH_EMAIL_CHECK_BEFORE: "We've sent a confirmation link to ",
  AUTH_EMAIL_CHECK_AFTER: '. Please check your inbox and click the link to activate your account.',
  AUTH_BACK_TO_SIGN_IN: 'Back to Sign In',

  AUTH_SIGNUP_SUCCESS_LOGO_ALT: 'Lingua Bloom Logo',
  AUTH_SIGNUP_SUCCESS_TITLE: 'Check Your Email',
  AUTH_SIGNUP_SUCCESS_DESC: "We've sent you a confirmation link to verify your email address.",
  AUTH_SIGNUP_SUCCESS_HINT_1:
    'Click the link in the email to activate your account and start creating tests.',
  AUTH_SIGNUP_SUCCESS_HINT_2: "Don't see the email? Check your spam folder.",

  AUTH_ERROR_TITLE: 'Sorry, something went wrong.',
  AUTH_ERROR_CODE_PREFIX: 'Code error: ',
  AUTH_ERROR_UNSPECIFIED: 'An unspecified error occurred.',

  LESSON_RUN_TAB_TEXT: 'Текстовый ввод',
  LESSON_RUN_TAB_FILES: 'Подгрузка файлов',
  LESSON_RUN_MATERIAL_SLOT: 'Материал',
  LESSON_RUN_MATERIAL_HINT:
    'Вставьте текст — сценарий (план урока или сразу тест) выберет модель по содержанию.',
  LESSON_RUN_FILE_NOTES_LABEL: 'Пояснение к тестам',
  LESSON_RUN_FILE_NOTES_HINT:
    'Необязательно: уточните контекст, уровень учеников или что важно учесть при генерации.',
  LESSON_RUN_FILE_NOTES_PLACEHOLDER:
    'Например: это домашка по Present Perfect, нужны задания на выбор и пропуски.',
  LESSON_RUN_START: 'Запустить генерацию',
  LESSON_RUN_SEND_RESUME: 'Продолжить',
  LESSON_RUN_PLAN_LABEL: 'Правки к плану (оставьте пустым, чтобы принять как есть)',
  LESSON_RUN_ANSWERS_LABEL: 'Правильные ответы (свободная форма)',
  LESSON_RUN_AUTO_BUTTON: 'Авто-ответы модели (точность не гарантируется)',
  LESSON_RUN_ANSWERS_MODE_MANUAL: 'Ввести ответы',
  LESSON_RUN_ANSWERS_MODE_AUTO: 'Автоответы',
  LESSON_RUN_LOG_TITLE: 'Шаги',
  LESSON_RUN_DROP_MATERIAL: 'PDF — можно несколько файлов',
  LESSON_RUN_CLEAR_FILES: 'Очистить файлы',
  LESSON_RUN_BUSY_HINT_TITLE: 'Генерация займёт около 2 минут',
  LESSON_RUN_BUSY_HINT_SUBTITLE:
    'Самый длинный шаг — сборка JSON-спецификации теста. Не закрывайте вкладку, шаги обновляются ниже.',
  LESSON_RUN_WAITING_FIRST_STEP: 'Ожидаем первый шаг пайплайна…',
  LESSON_RUN_NEW_TEST: '← Новый тест',
  LESSON_RUN_READY: 'Тест готов!',
  LESSON_RUN_OPEN: 'Открыть тест',
  LESSON_RUN_FAILED_TITLE: 'Генерация остановлена',
  LESSON_RUN_ACCEPT_PLAN: 'Принять план и продолжить',

  SETTINGS_PROFILE_PAGE_TITLE: 'Настройки профиля',
  SETTINGS_PROFILE_GUIDE_TITLE: 'Как подключить Telegram',
  SETTINGS_PROFILE_GUIDE_INTRO:
    'После настройки бота вы будете получать в Telegram ФИО студента, баллы и ответы, когда он завершит тест.',
  SETTINGS_PROFILE_GUIDE_STEP_1:
    'Откройте в Telegram @BotFather и отправьте команду /newbot — придумайте имя и username для бота.',
  SETTINGS_PROFILE_GUIDE_STEP_2:
    'Скопируйте Bot Token из ответа BotFather и вставьте его в поле ниже.',
  SETTINGS_PROFILE_GUIDE_STEP_3:
    'Найдите своего нового бота в Telegram и отправьте ему /start — без этого сообщения бот не сможет писать вам.',
  SETTINGS_PROFILE_GUIDE_STEP_4:
    'Узнайте свой Chat ID: напишите @userinfobot или @getidsbot и скопируйте число из поля Id.',
  SETTINGS_PROFILE_GUIDE_STEP_5:
    'Заполните форму ниже, нажмите «Сохранить», затем «Отправить тест» — должно прийти пробное сообщение.',
  SETTINGS_PROFILE_GUIDE_FOOTER:
    'Токен бота хранится только на сервере и не показывается повторно. Не делитесь им с другими людьми.',

  SETTINGS_TELEGRAM_PAGE_TITLE: 'Настройки профиля',
  SETTINGS_TELEGRAM_TITLE: 'Результаты тестов',
  SETTINGS_TELEGRAM_SUBTITLE:
    'Когда студент завершает тест, бот отправит вам ФИО, баллы и ответы по каждому вопросу.',
  SETTINGS_TELEGRAM_ENABLED: 'Отправлять результаты тестов в Telegram',
  SETTINGS_TELEGRAM_CHAT_ID: 'Chat ID',
  SETTINGS_TELEGRAM_CHAT_ID_HINT:
    'Ваш числовой chat id. Узнать можно у @userinfobot или @getidsbot в Telegram.',
  SETTINGS_TELEGRAM_BOT_TOKEN: 'Bot Token',
  SETTINGS_TELEGRAM_BOT_TOKEN_PLACEHOLDER: '123456789:AAH...',
  SETTINGS_TELEGRAM_BOT_TOKEN_KEEP: 'Токен сохранён — введите новый, только если нужно заменить',
  SETTINGS_TELEGRAM_BOT_TOKEN_HINT:
    'Создайте бота через @BotFather, скопируйте token и напишите боту /start в личку. При первом сохранении token обязателен.',
  SETTINGS_TELEGRAM_CHAT_ID_REQUIRED: 'Укажите Telegram Chat ID.',
  SETTINGS_TELEGRAM_TOKEN_REQUIRED:
    'Укажите Bot Token от @BotFather. Если token уже сохранялся раньше, поле можно оставить пустым.',
  SETTINGS_TELEGRAM_SAVE: 'Сохранить',
  SETTINGS_TELEGRAM_TEST: 'Отправить тест',
  SETTINGS_TELEGRAM_LOADING: 'Загрузка настроек…',
  SETTINGS_TELEGRAM_SAVE_SUCCESS: 'Настройки сохранены.',
  SETTINGS_TELEGRAM_TEST_SUCCESS: 'Тестовое сообщение отправлено в Telegram.',
  SETTINGS_TELEGRAM_LOAD_ERROR: 'Не удалось загрузить настройки.',
  SETTINGS_TELEGRAM_SAVE_ERROR: 'Не удалось сохранить настройки.',
  SETTINGS_TELEGRAM_TEST_ERROR: 'Не удалось отправить тестовое сообщение.',
} as const
