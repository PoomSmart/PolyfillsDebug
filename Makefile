include $(THEOS)/makefiles/common.mk

include $(THEOS_MAKE_PATH)/tweak.mk

ASSETS_PATH = layout/Library/Application Support/Polyfills

before-all:: js

js:
	@for dir in scripts-priority scripts scripts-post; do \
		if [ -d "$$dir" ]; then \
			for file in $$dir/*.js; do \
				if [ -f "$$file" ]; then \
					base=$$(basename "$$file" .js); \
					out="$(ASSETS_PATH)/$$dir/base/$$base.js"; \
					mkdir -p "$$(dirname "$$out")"; \
					npx uglify-js "$$file" --compress arrows=false --mangle -o "$$out"; \
					echo "Minified $$file -> $$out"; \
				fi; \
			done; \
		fi; \
	done
