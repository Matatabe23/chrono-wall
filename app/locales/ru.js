import { ru } from 'vuetify/locale';

export default {
	$vuetify: ru,

	common: {
		close: 'Закрыть',
		cancel: 'Отмена',
		save: 'Сохранить',
		delete: 'Удалить',
		create: 'Создать',
		back: 'Назад',
	},

	settings: {
		title: 'Настройки',
		frequencyLabel: 'Частота смены фото',
		currentLabel: 'Текущая: {label}',
		orderLabel: 'Отображать по',
		orderQueue: 'Очереди (новые → старые)',
		orderRandom: 'Рандомно без повторений',
		orderHint: 'Очереди: новые → старые; Рандом: без повторений за круг',
		targetLabel: 'Куда ставить обои',
		targetBoth: 'Экран и блокировка',
		targetLock: 'Только блокировка',
		targetHome: 'Только главный экран',
	},

	interval: {
		minutes: '{n} мин',
		hour: '1 час',
		hours2_4: '{n} часа',
		hours5plus: '{n} часов',
	},

	collections: {
		title: 'Коллекции обоев',
		create: 'Создать коллекцию',
		emptyTitle: 'Нет коллекций',
		emptyHint: 'Создайте первую коллекцию для организации ваших обоев',
		active: 'Активна',
		pause: 'Пауза',
		start: 'Старт',
		defaultName: 'Коллекция',
	},

	collectionCreate: {
		title: 'Создать коллекцию',
		nameLabel: 'Название коллекции',
		nameRequired: 'Название обязательно',
		nameExists: 'Коллекция с таким названием уже существует',
	},

	collectionDelete: {
		title: 'Удаление коллекции',
		confirm: 'Вы уверены, что хотите удалить коллекцию «{name}»?',
		deleteFiles: 'Файлы тоже удалить',
	},

	addPhoto: {
		title: 'Добавить фото в коллекцию "{name}"',
		pickImage: 'Выбрать изображение',
		imagesFilter: 'Изображения',
	},

	collectionPage: {
		addPhoto: 'Добавить фото',
		noImages: 'Нет изображений',
		addPhotosHint: 'Добавьте фото в эту коллекцию',
		pageOf: 'Страница {current} из {total} · {count} фото',
		deletePhotoTitle: 'Удаление фото',
		deletePhotoConfirm: 'Вы уверены, что хотите удалить это фото из коллекции?',
	},

	warnings: {
		rotationStoppedSettings: 'Ротация отключена: изменены настройки. Запустите коллекцию заново.',
		rotationStoppedPhotoAdded: 'Ротация отключена: в коллекцию добавлено фото. Запустите коллекцию заново.',
		rotationStoppedPhotoDeleted: 'Ротация отключена: фото удалено из коллекции. Запустите коллекцию заново.',
	},
};
