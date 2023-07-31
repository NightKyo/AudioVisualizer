class fft {
    /**
     * 
     * @param {Audio} audioPlayer 
     */
    constructor(audioPlayer) {
        this.audioPlayer = audioPlayer;

        this.N = 16384;
        this.QUAD_SIZE = 8;
        //this.freq_bin = [20, 60, 250, 500];
        this.freq_bin = [20, 60, 250, 500];

        this.SplitChannels = false;
        this.circleMode = false;
        this.offset = false;
        //this.color = "#80ff00"; // lime
        //this.color = "#0080ff";// blue
        //this.color = "#8000ff";// purple
        this.color = "#ff4000";// orange
    }

    init(arrayBuffer) {

        // init from here because of autoplay policy
        this.audioContext = new AudioContext();

        // BufferSource will hold audio data
        this.source = this.audioContext.createBufferSource();

        // Decode audio
        this.audioContext.decodeAudioData(arrayBuffer).then(buffer => {
            this.source.buffer = buffer;
            this.source.connect(this.audioContext.destination);

            console.log(buffer);

            // Audio Samples
            this.data = this.source.buffer.getChannelData(0);
            console.log(this.data);

            // SplitChannels option
            if (this.SplitChannels) {
                if (this.source.buffer.numberOfChannels == 1) {
                    this.SplitChannels = false;
                } else {
                    this.data2 = this.source.buffer.getChannelData(1);
                    console.log(this.data2);
                }
            }

            // Start player
            this.audioPlayer.play();

            console.log(`SampleCount: ${this.N}`);
            console.log(`SplitChannels: ${this.SplitChannels}`);
            console.log(`AudioLoop: ${this.audioPlayer.loop}`);
            console.log(`QuadSize: ${this.QUAD_SIZE}`);
        });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getPeakMaxArray() {
        // Get first data bin position for current time in the song
        // example: 5 seconds * 44100(sampleRate) means that our starting position is 220500 
        //          and then we take N number of bins from that position onward
        const mark = Number.parseInt((this.audioPlayer.currentTime * this.source.buffer.sampleRate).toString());

        let input = new Array(this.N);

        const twoPIOverNMinusOne = 2.0 * Math.PI / (this.N - 1);
        //const fourPIOverNMinusOne = 4.0 * Math.PI / (this.N - 1);
        // Fill in input  
        for (let i = 0; i < this.N; i++) {

            let index = i + mark;

            // Hamming window the input for smoother input values
            let sample = this.data[index] * (0.54 - (0.46 * Math.cos(twoPIOverNMinusOne * i)));
            //let sample = this.data[index] * (0.54 - (0.46 * Math.cos(2.0 * Math.PI * (i / ((this.N - 1) * 1.0)))));

            // Blackman window the input for sharper input values
            //let sample = this.data[index] * (0.42 - 0.5 * Math.cos(twoPIOverNMinusOne * i) + 0.08 * Math.cos(fourPIOverNMinusOne * i)) ;
            //let sample = this.data[index] * (0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (this.N - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (this.N - 1)));

            // Windowed sample or signal
            input[i] = (sample);
        }

        // Calculate fft
        const output = this.cfft(input);

        let peakmaxArray = [];
        const halfN = Math.floor(this.N / 2) + 1;
        const freqFactor = this.source.buffer.sampleRate / this.N;
        // Calculate the magnitudes
        /* Only half of the data is useful */
        for (let i = 0; i < halfN; i++) {

            // bin frequency = binNumber * sampleRate / N
            let freq = i * freqFactor;
            let magnitude = output[i].magnitude();

            // Extract the peaks from defined frequency ranges

            for (let j = 0; j < this.freq_bin.length - 1; j++) {
                if ((freq > this.freq_bin[j]) && (freq <= this.freq_bin[j + 1])) {
                    peakmaxArray.push(magnitude );
                }
            }
        }

        return peakmaxArray;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    render() {

        // Only if this.audioPlayer has started run
        if (!this.audioPlayer.paused && this.audioPlayer.currentTime) {

            let peakmaxArray = this.getPeakMaxArray();
            const length = peakmaxArray.length
            var w = this.QUAD_SIZE;
            if(this.offset){
                w *= 0.85;
            }

            // Visualize the magnitudes
            const startX = WIDTH / 2 - (length * this.QUAD_SIZE / 2);
            const y = HEIGHT;

            clear();
            for (let i = 0; i < length; i++) {

                const x = startX + i * this.QUAD_SIZE;
                const height = peakmaxArray[i] * 0.25 + 2;

                drawFillRect(x, y, w, - height  , this.color);
                //drawFillRect(x, y, w, - height  , `rgb(${d},${d},${d})`);
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    render2Channels() {

        // Only if this.audioPlayer has started run
        if (!this.audioPlayer.paused || this.audioPlayer.currentTime) {

            const mark = Number.parseInt((this.audioPlayer.currentTime * this.source.buffer.sampleRate).toString());

            let input1 = new Array(this.N / 2);
            let input2 = new Array(this.N / 2);

            // Fill in input
            /* Each channel gets half of the sampleCount */
            for (let i = 0; i < (this.N / 2); i++) {

                let index = i + mark;

                // Hamming window the input
                let sample1 = this.data[index] * (0.54 - (0.46 * Math.cos(2.0 * Math.PI * (i / (((this.N / 2) - 1) * 1.0)))));
                let sample2 = this.data2[index] * (0.54 - (0.46 * Math.cos(2.0 * Math.PI * (i / (((this.N / 2) - 1) * 1.0)))));
                
                // Windowed sample / signal
                input1[i] = (sample1);
                input2[i] = (sample2);
            }

            // Calculate fft
            const output1 = this.cfft(input1);
            const output2 = this.cfft(input2);

            let peakmaxArray1 = [];
            let peakmaxArray2 = [];

            // Calculate the magnitudes
            /* Only half of the magnitudes are valuable data
               since we have 2 channels we have to divide N by 2 and 
               then divide by 2 again to get the valuable data */
            const fourN = (this.N / 4) + 1
            const freqFactor = this.source.buffer.sampleRate / (this.N / 2);
            for (let i = 0; i < fourN; i++) {

                let freq1 = i * freqFactor;
                let magnitude1 = output1[i].magnitude();
                let freq2 = i * freqFactor;
                let magnitude2 = output2[i].magnitude();

                for (let j = 0; j < this.freq_bin.length - 1; j++) {
                    if ((freq1 > this.freq_bin[j]) && (freq1 <= this.freq_bin[j + 1])) {
                        peakmaxArray1.push(magnitude1);
                    }
                    if ((freq2 > this.freq_bin[j]) && (freq2 <= this.freq_bin[j + 1])) {
                        peakmaxArray2.push(magnitude2);
                    }
                }
            }

            // Clear screen
            clear();

            const startX = ((WIDTH / 2) - ((peakmaxArray1.length + peakmaxArray2.length) * this.QUAD_SIZE / 2));
            const y = HEIGHT;
            // Visualize the magnitudes
            for (let i = 0; i < peakmaxArray1.length; i++) {

                const x =startX+ i * this.QUAD_SIZE ;

                const height = peakmaxArray1[i] * 0.25;

                drawFillRect(x, y, this.QUAD_SIZE, -height, 'red');
            }

            for (let i = peakmaxArray1.length; i < peakmaxArray1.length + peakmaxArray2.length; i++) {

                const x = startX+i * this.QUAD_SIZE;
                const height = peakmaxArray2[i - peakmaxArray1.length] * 0.25+2;

                drawFillRect(x, y, this.QUAD_SIZE, -height, 'cyan');
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    cfft(amplitudes) {
        var N = amplitudes.length;
        if (N <= 1)
            return amplitudes;

        var hN = N / 2;
        var even = [];
        var odd = [];
        even.length = hN;
        odd.length = hN;
        for (var i = 0; i < hN; ++i) {
            even[i] = amplitudes[i * 2];
            odd[i] = amplitudes[i * 2 + 1];
        }
        even = this.cfft(even);
        odd = this.cfft(odd);

        var a = -2 * Math.PI;
        for (var k = 0; k < hN; ++k) {
            if (!(even[k] instanceof Complex))
                even[k] = new Complex(even[k], 0);
            if (!(odd[k] instanceof Complex))
                odd[k] = new Complex(odd[k], 0);
            var p = k / N;
            var t = new Complex(0, a * p);
            t.cexp(t).mul(odd[k], t);
            amplitudes[k] = even[k].add(t, odd[k]);
            amplitudes[k + hN] = even[k].sub(t, even[k]);
        }
        return amplitudes;
    }
}