import { en } from 'vuetify/locale';

export default {
	$vuetify: en,

	common: {
		close: 'Close',
		cancel: 'Cancel',
		save: 'Save',
		delete: 'Delete',
		create: 'Create',
		back: 'Back',
	},

	settings: {
		title: 'Settings',
		frequencyLabel: 'Wallpaper change frequency',
		currentLabel: 'Current: {label}',
		orderLabel: 'Display order',
		orderQueue: 'Queue (newest → oldest)',
		orderRandom: 'Random, no repeats',
		orderHint: 'Queue: newest → oldest; Random: no repeats per cycle',
		targetLabel: 'Where to set wallpaper',
		targetBoth: 'Home and lock screen',
		targetLock: 'Lock screen only',
		targetHome: 'Home screen only',
	},

	interval: {
		minutes: '{n} min',
		hour: '1 hour',
		hours2_4: '{n} hours',
		hours5plus: '{n} hours',
	},

	collections: {
		title: 'Wallpaper collections',
		create: 'Create collection',
		emptyTitle: 'No collections',
		emptyHint: 'Create your first collection to organize your wallpapers',
		active: 'Active',
		pause: 'Pause',
		start: 'Start',
		defaultName: 'Collection',
	},

	collectionCreate: {
		title: 'Create collection',
		nameLabel: 'Collection name',
		nameRequired: 'Name is required',
		nameExists: 'A collection with this name already exists',
	},

	collectionDelete: {
		title: 'Delete collection',
		confirm: 'Are you sure you want to delete the collection "{name}"?',
		deleteFiles: 'Delete files too',
	},

	addPhoto: {
		title: 'Add photo to collection "{name}"',
		pickImage: 'Choose image',
		pickImages: 'Choose photos',
		addingBatch: 'Adding {current} of {total}',
		imagesFilter: 'Images',
	},

	collectionPage: {
		addPhoto: 'Add photo',
		noImages: 'No images',
		addPhotosHint: 'Add photos to this collection',
		pageOf: 'Page {current} of {total} · {count} photos',
		deletePhotoTitle: 'Delete photo',
		deletePhotoConfirm: 'Are you sure you want to delete this photo from the collection?',
	},

	warnings: {
		rotationStoppedSettings: 'Rotation stopped: settings changed. Start the collection again.',
		rotationStoppedPhotoAdded: 'Rotation stopped: photo added to collection. Start the collection again.',
		rotationStoppedPhotoDeleted: 'Rotation stopped: photo deleted from collection. Start the collection again.',
	},
};
