function onReady(func) {
    if (document.readyState === 'complete') {
        setTimeout(func, 300)
    }
    else {
        readyStateCheckInterval = setInterval(function () {
            if (document.readyState === 'complete') {
                clearInterval(readyStateCheckInterval)
                setTimeout(func, 300)
            }
        }, 300)
    }
}

MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

var observer
var changeSpeedWithKeysListener
onReady(main);

// https://stackoverflow.com/a/71692555
function querySelectorAllShadows(selector, el = document.body) {
    // recurse on childShadows
    const childShadows = Array.from(el.querySelectorAll('*')).
        map(el => el.shadowRoot).filter(Boolean);
    const childResults = childShadows.map(child => querySelectorAllShadows(selector, child));
    // fuse all results into singular, flat array
    const result = Array.from(el.querySelectorAll(selector));
    return result.concat(childResults).flat();
}

function main() {
    let container
    let source
    let scrollVolumeToggle = false

    const Toast = Swal.mixin({
        toast: true,
        position: "top-start",
        showConfirmButton: false,
        timer: 1776,
        timerProgressBar: true
    });

    function checkForSource() {
        if (document.location.href.includes('kanopy')) {
            source = 'kanopy'
            container = document.getElementById('vjs_video_3')
        } else if (document.location.href.includes('youtube')) {
            if (document.location.href.includes('shorts')) {
                source = 'shorts'
                container = [...document.getElementsByTagName('html')][0]
            } else {
                source = 'youtube'
                container = document.getElementById('above-the-fold')
            }
        } else if (document.location.href.includes('netflix')) {
            source = 'netflix'
            container = document.getElementsByClassName('watch-video')[0]
        } else if (document.location.href.includes('amazon')) {
            source = 'amazon'
            container = document.getElementsByTagName('html')[0]
        } else if (document.location.href.includes('hbo')) {
            source = 'hbo'
            container = document.getElementsByClassName('default')[17]
        } else if (document.location.href.includes('acloud.guru')) {
            source = 'acloudguru'
            container = document.getElementsByClassName('player-fullscreen-wrapper')[0]
        } else if (document.location.href.includes('disney')) {
            source = 'disney'
            container = document.getElementById('app_body_content')
        } else if (document.location.href.includes('apple')) {
            source = 'apple'
            container = [...document.getElementsByTagName('html')][0]
        } else if (document.location.href.includes('instagram')) {
            source = 'instagram'
            container = [...document.getElementsByTagName('html')][0]
        } else {
            source = 'unknown'
            container = [...document.getElementsByTagName('html')][0]
        }
        if (!container) {
            container = [...document.getElementsByTagName('html')][0]
        }
    }
    checkForSource()

    observer = new MutationObserver(function (mutations, observer) {
        mutations.forEach(mutation => {
            let text = mutation.target.outerHTML
            if (text.includes('yt-page-navigation-progress') && !text.includes('yt-touch-feedback-shape')) {
                checkForSource()
                if (source !== 'shorts') deleteEverything()
            }
        })
    });
    observer.observe(document, {
        subtree: true,
        attributes: true
    });

    let slider = document.getElementById('speedSlider')
    let video
    let iframe = document.getElementsByTagName('iframe').length ? document.getElementsByTagName('iframe') : null
    if (source === 'amazon') {
        vid_elem = document.getElementsByTagName('video')
        video = vid_elem[vid_elem.length - 1]
    } else {
        try {
            let v = querySelectorAllShadows('video')
            let y = [...document.getElementsByTagName('video')]
            video = v.length > y.length ? v[0] : y[0]
            if ( !video.src ) console.log(`no video.src found for ${video}, source: ${source}`)
        } catch (error) {
            console.log('Could not find a video element:', error)
        }
    }

    function createSlider() {
        let br = document.createElement('br')

        let div = document.createElement('div')
        div.id = 'sliderContainer'
        if (source === 'youtube') {
            div.style.cssText = 'position: relative; margin: 0 auto 3rem;'
        } else if (source === 'netflix') {
            div.style.cssText = 'position: relative; margin: 0px auto 3rem; z-index: 9999;'
        } else if (source === 'disney') {
            div.style.cssText = 'position: relative; margin: 0px auto 3rem; z-index: 9999; width: 100%; top: 5vh;'
        } else if (source === 'amazon') {
            div.style.cssText = 'position: fixed !important; margin: 50px auto 3rem; z-index: 99999; width: 100%; top: 8vh; height: 5vh;'
        } else if (source === 'hbo' || source === 'kanopy') {
            div.style.cssText = 'position: relative; margin: 0px auto 3rem; z-index: 9999;'
        } else if (source === 'acloudguru') {
            div.style.cssText = 'position: absolute; margin: 0px auto 3rem; z-index: 9999; width: 100%;'
        } else if (source === 'apple') {
            div.style.cssText = 'position: fixed; margin: 50px auto 3rem; z-index: 9999; width: 100%;'
        } else if (source === 'unknown' || source === 'shorts') {
            div.style.cssText = 'position: fixed; margin 0px auto 3rem; z-index: 9999999;, width: 98vw !important;'
        } else if (source === 'instagram') {
            div.style.cssText = 'position: fixed; margin 0px auto 3rem; z-index: 9999999;, width: 98vw !important;'
        }
        div.style.cssText += 'transition: all 450ms ease'

        let sliderLabel = document.createElement('output')
        let siteColor
        switch (source) {
            case 'youtube':
                siteColor = 'rgb(255,0,0)'
                break;
            case 'shorts':
                siteColor = 'rgb(255,0,0)'
                break;
            case 'netflix':
                siteColor = 'rgb(219,0,0)'
                break;
            case 'disney':
                siteColor = 'rgb(0,110,153)';
                break;
            default:
                siteColor = 'rgb(221, 149, 15)'
        }
        sliderLabel.id = 'sliderLabel'
        sliderLabel.innerText = '1'
        sliderLabel.style.cssText = `position: absolute; background-color: ${siteColor}; color: white; font-size: 1.5em; text-align: center; padding: 3px 8px; top: 105%;`

        let resetButton = document.createElement('button')
        resetButton.id = 'resetButton'
        resetButton.innerText = 'Reset'
        resetButton.style.cssText = `float: right; color: white; background: none; font-size: 1.5em; text-align: center; border: 1px solid ${siteColor}; border-radius: 1px; margin-bottom: 3px;`

        let deleteEverythingButton = document.createElement('button')
        deleteEverythingButton.id = 'deleteEverything'
        deleteEverythingButton.innerText = 'X'
        deleteEverythingButton.title = "Close Stream Speed"
        deleteEverythingButton.style.cssText = `float: none; margin-left: 40%; color: white; background: red; font-size: 1.1em; text-align: center; border: 2px solid red; border-radius: 50%; opacity: 0.7`

        let toggleScrollVolumeButton = document.createElement('button')
        let showVolumeButton = navigator.languages.some(el => el === 'ru-RU') ? 'none' : 'inherit'
        toggleScrollVolumeButton.id = 'toggleScrollVolumeButton'
        toggleScrollVolumeButton.innerText = 'Volume Scroll'
        toggleScrollVolumeButton.style.cssText = `display: ${showVolumeButton}; float: left; color: white; background: none; font-size: 1.5em; text-align: center; border: 1px solid ${siteColor}; border-radius: 1px; margin-bottom: 3px;`

        range = document.createElement('input')
        range.type = 'range'
        range.id = 'speedSlider'
        range.setAttribute('min', '0.1')
        range.setAttribute('max', '16')
        range.setAttribute('step', '0.1')
        range.setAttribute('value', '1')
        if (source === 'youtube') {
            range.style.cssText = `-webkit-appearance: none; background-color: ${siteColor}; opacity: 0.9; width: 100%;`
        } else {
            range.style.cssText = `-webkit-appearance: none; background-color: ${siteColor}; opacity: 0.9; width: 100vw;`
        }

        div.prepend(br)
        div.appendChild(resetButton)
        div.appendChild(deleteEverythingButton)
        div.appendChild(toggleScrollVolumeButton)
        div.appendChild(sliderLabel)
        div.appendChild(br)
        div.appendChild(range)
        div.appendChild(br)
        container.prepend(div)
    }

    if (!slider) {
        createSlider()
    }

    slider = document.getElementById('speedSlider')

    function deleteEverything() {
        if (observer) observer.disconnect()
        source = ''
        if (document.getElementById('sliderContainer')) document.getElementById('sliderContainer').remove()
        if (video) {
            resetSpeed()
            video.volume = 1
            if (iframe.contentDocument) {
                iframe.contentDocument.removeEventListener('wheel', checkScrollDirection, { passive: false })
                iframe.contentDocument.removeEventListener('click', toggleScrollVolume, { passive: false })
                iframe.contentDocument.removeEventListener('click', resetSpeed, { passive: false })
                iframe.contentDocument.removeEventListener('mouseup', updateSpeed, { passive: false })
                iframe.contentDocument.removeEventListener('mousemove', showAndHideSlider, { passive: false })
                iframe.contentDocument.removeEventListener('keydown', changeSpeedWithKeys, { passive: false })
                iframe.contentDocument.removeEventListener('click', deleteEverything, { passive: false })
            }
            window.removeEventListener('wheel', checkScrollDirection, { passive: false })
            window.removeEventListener('click', toggleScrollVolume, { passive: false })
            window.removeEventListener('click', resetSpeed, { passive: false })
            window.removeEventListener('mouseup', updateSpeed, { passive: false })
            window.removeEventListener('mousemove', showAndHideSlider, { passive: false })
            window.removeEventListener('keydown', changeSpeedWithKeys, { passive: false })
            window.removeEventListener('click', deleteEverything, { passive: false })
        }
    }

    let resetButton = document.getElementById('resetButton')

    function updateSpeed() {
        // technically this could be if any video list length is greater than 1, to iterate over the list of videos
        // but there may be a reason I chose 2 for some sites where it breaks if its less than 1. 
        // should look into the most popular sites and see if everything works with a video arr len of just > 1
        // so it iterates over every vidya on the page and doesn't break. This is the reason why disney plus was broken.
        if (source === 'instagram' || source === 'unknown' || source === 'disney' || document.getElementsByTagName('video').length > 2) {
            let videos = querySelectorAllShadows('video')
            videos.map(vid => {
                video = vid
                video.playbackRate = slider.value
            })
            updateSliderLabel(videos[0].playbackRate)
        } else {
            video.playbackRate = slider.value
            updateSliderLabel(video.playbackRate)
        }
    }

    function resetSpeed() {
        slider.value = 1.0
        if (source === 'instagram' || source === 'unknown') {
            let videos = querySelectorAllShadows('video')
            videos.map(vid => {
                video = vid
                video.playbackRate = 1
            })
            updateSliderLabel(videos[0].playbackRate)
        } else {
            video.playbackRate = 1
            updateSliderLabel(video.playbackRate)
        }
    }

    function updateSliderLabel(speed) {
        checkForSource()
        if (!slider) {
            createSlider()
        }
        let sliderLabel = document.getElementById('sliderLabel')
        if (!sliderLabel) return
        if (source !== 'youtube') {
            showAndHideSlider()
        }
        let currentSpeed = speed.toString()
        if (currentSpeed.length === 1) {
            currentSpeed = currentSpeed + '.0'
        }
        let sliderVal = speed * 10 / 16
        sliderLabel.innerText = currentSpeed
        sliderLabel.style.left = 'calc(' + sliderVal * 9.6 + '% + (' + (8 - sliderVal * 0.28) + 'px))'
    }

    let fadingOut = false
    function showAndHideSlider() {
        let sliderContainer = document.getElementById('sliderContainer')
        // TODO fix this ease in/out
        // look into using https://developer.chrome.com/docs/extensions/reference/tabs/#method-insertCSS
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/insertCSS
        // sliderContainer.style.cssText = sliderContainer.style.cssText.split('transition: .5s ease-out;')[0]
        // sliderContainer.style.cssText += 'transition: .5s ease-in;'
        if (sliderContainer) sliderContainer.style.opacity = '100%'
        if (!fadingOut && sliderContainer) {
            // sliderContainer.style.cssText = sliderContainer.style.cssText.split('transition: .5s ease-in;')[0]
            // sliderContainer.style.cssText = 'transition: .5s ease-out;'
            setTimeout(() => {
                sliderContainer.style.opacity = '0%'
                fadingOut = false
            }, 2000)
            fadingOut = true
        }
    }

    function changeSpeedWithKeys(event) {
        if (source === 'instagram' || document.getElementsByTagName('video').length > 2) {
            changeSpeedWithKeysVideoWall(event)
        } else {
            if (event.keyCode === 187 || event.keyCode === 221) {
                if (video.playbackRate < 1.5) {
                    video.playbackRate = (video.playbackRate += 0.05).toFixed(2)
                } else if (video.playbackRate >= 1.5) {
                    video.playbackRate = (video.playbackRate += 0.1).toFixed(1)
                }
            }
            if ((event.keyCode === 189 || event.keyCode === 219) && video.playbackRate > 0.1) {
                if (video.playbackRate <= 1.5) {
                    video.playbackRate = (video.playbackRate -= 0.05).toFixed(2)
                } else if (video.playbackRate > 1.5) {
                    video.playbackRate = (video.playbackRate -= 0.1).toFixed(1)
                }
            }
            if (event.keyCode === 8 || event.keyCode === 220) {
                video.playbackRate = 1.0
            }
            slider = document.getElementById('speedSlider')
            updateSliderLabel(video.playbackRate.toFixed(2))
            slider.value = video.playbackRate.toFixed(2)
        }
    }


    function changeSpeedWithKeysVideoWall(event) {
        let videos = querySelectorAllShadows('video')
        videos.map(vid => {
            video = vid
            if (event.keyCode === 187 || event.keyCode === 221) {
                if (video.playbackRate < 1.5) {
                    video.playbackRate = (video.playbackRate += 0.05).toFixed(2)
                } else if (video.playbackRate >= 1.5) {
                    video.playbackRate = (video.playbackRate += 0.1).toFixed(1)
                }
            }
            if ((event.keyCode === 189 || event.keyCode === 219) && video.playbackRate > 0.1) {
                if (video.playbackRate <= 1.5) {
                    video.playbackRate = (video.playbackRate -= 0.05).toFixed(2)
                } else if (video.playbackRate > 1.5) {
                    video.playbackRate = (video.playbackRate -= 0.1).toFixed(1)
                }
            }
            if (event.keyCode === 8 || event.keyCode === 220) {
                video.playbackRate = 1.0
            }
            updateSliderLabel(video.playbackRate.toFixed(2))
            slider.value = video.playbackRate.toFixed(2)
        })
    }

    let deleteEverythingButton = document.getElementById('deleteEverything')
    deleteEverythingButton.addEventListener('click', deleteEverything)

    slider.addEventListener('mouseup', updateSpeed)
    resetButton.addEventListener('click', resetSpeed)

    if ((source === 'unknown' || source === 'shorts')) {
        if (querySelectorAllShadows('video').length) {
            if (iframe && iframe.contentDocument) {
                if (!changeSpeedWithKeysListener) {
                    iframe.contentDocument.addEventListener('keydown', changeSpeedWithKeys)
                    changeSpeedWithKeysListener = true
                }
                iframe.contentDocument.addEventListener('mousemove', showAndHideSlider)
            } else {
                if (!changeSpeedWithKeysListener) {
                    document.addEventListener('keydown', changeSpeedWithKeys)
                    changeSpeedWithKeysListener = true
                }
                document.addEventListener('keydown', showAndHideSlider)
            }
        }
    } else if (document && !changeSpeedWithKeysListener) {
        changeSpeedWithKeysListener = true
        document.addEventListener('keydown', changeSpeedWithKeys)
    }
    if (source !== 'youtube') {
        document.addEventListener('mousemove', showAndHideSlider)
    }
    updateSliderLabel(1)
    if (source === 'hbo') {
        let elements = [...document.getElementsByTagName("*")]
        for (let i in elements) {
            elements[i].style.cursor = 'none'
        }
        document.addEventListener('mousemove', () => {
            for (let j in elements) {
                elements[j].style.cursor = 'auto'
            }
            setTimeout(() => {
                for (let k in elements) {
                    elements[k].style.cursor = 'none'
                }
            }, 3000)
        })
    }
    if (source === 'acloudguru') {
        let resetButton = document.getElementById('resetButton')
        resetButton.style.right = '10vw'
        resetButton.style.position = 'absolute'
    }

    function checkScrollDirection(event) {
        if (source === 'instagram' || document.getElementsByTagName('video').length > 2) {
            checkScrollDirectionVideoWall(event)
        } else {
            event.preventDefault()
            if (checkScrollDirectionIsUp(event)) {
                if ((Math.ceil(video.volume * 100) / 100) < .98) {
                    video.volume = (Math.round(video.volume * 100) / 100 + 0.02)
                } else if ((Math.ceil(video.volume * 100) / 100) < 1) {
                    video.volume = (Math.round(video.volume * 100) / 100 + 0.01)
                }
            } else {
                if ((Math.floor(video.volume * 100) / 100) >= 0.02) video.volume = (Math.round(video.volume * 100) / 100 - 0.02)
            }
            // return false
        }
    }

    function checkScrollDirectionVideoWall(event) {
        event.preventDefault()
        let videos = querySelectorAllShadows('video')
        videos.map(vid => {
            video = vid
            if (checkScrollDirectionIsUp(event)) {
                if ((Math.ceil(video.volume * 100) / 100) < .98) {
                    video.volume = (Math.round(video.volume * 100) / 100 + 0.02)
                } else if ((Math.ceil(video.volume * 100) / 100) < 1) {
                    video.volume = (Math.round(video.volume * 100) / 100 + 0.01)
                }
            } else {
                if ((Math.floor(video.volume * 100) / 100) >= 0.02) video.volume = (Math.round(video.volume * 100) / 100 - 0.02)
            }
        })
        // return false
    }

    function checkScrollDirectionIsUp(event) {
        if (event.wheelDelta) {
            return event.wheelDelta > 0;
        }
        return event.deltaY < 0;
    }

    let scrollVolume = false
    function toggleScrollVolume() {
        if (!scrollVolumeToggle) {
            scrollVolumeToggle = true
            Toast.fire({
                icon: 'warning',
                title: 'Volume Scrolling Enabled'
            })
        } else {
            scrollVolumeToggle = false
            Toast.fire({
                icon: 'success',
                title: 'Volume Scrolling Disabled'
            })
        }
        let classes = [
            "swal2-container",
            "swal2-top-start",
            "swal2-backdrop-show",
            "swal2-toast",
            "swal2-popup",
            "swal2-icon-warning",
            "swal2-show"
        ]
        classes.map(c => {
            let clas = [...document.getElementsByClassName(c)]
            clas.map(c => c.style.zIndex = 2147483645)
        })


        if (!scrollVolume) {
            window.addEventListener('wheel', checkScrollDirection, { passive: false })
            scrollVolume = true
        } else {
            window.removeEventListener('wheel', checkScrollDirection, { passive: false })
            scrollVolume = false
        }
    }
    let scrollVolumeButton = document.getElementById('toggleScrollVolumeButton')
    scrollVolumeButton.addEventListener('click', toggleScrollVolume)

}
